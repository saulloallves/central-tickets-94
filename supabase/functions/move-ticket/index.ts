import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, toStatus, beforeId, afterId } = await req.json();

    if (!ticketId || !toStatus) {
      return new Response(JSON.stringify({ error: 'ticketId e toStatus são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🎯 Processing ticket move:', { ticketId, toStatus, beforeId, afterId });

    // Get current ticket
    const { data: currentTicket, error: currentError } = await supabase
      .from('tickets')
      .select('id, status, position, unidade_id')
      .eq('id', ticketId)
      .single();

    if (currentError || !currentTicket) {
      console.error('❌ Failed to get current ticket:', currentError);
      return new Response(JSON.stringify({ error: currentError?.message || 'Ticket não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📋 Current ticket:', currentTicket);

    // Calculate new position using fractional indexing
    const { data: newPosition, error: positionError } = await supabase
      .rpc('calculate_new_position', {
        p_status: toStatus,
        p_before_id: beforeId || null,
        p_after_id: afterId || null
      });

    if (positionError) {
      console.error('❌ Failed to calculate position:', positionError);
      return new Response(JSON.stringify({ error: 'Erro ao calcular nova posição' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📐 Calculated new position:', newPosition);

    // Prepare update payload
    const updatePayload: any = {
      position: newPosition,
      updated_at: new Date().toISOString(),
    };

    // Only update status if it's actually changing
    if (toStatus !== currentTicket.status) {
      updatePayload.status = toStatus;
      console.log('🔄 Status changing from', currentTicket.status, 'to', toStatus);
      
      // Se mudando para concluído, marcar data de resolução
      if (toStatus === 'concluido') {
        updatePayload.resolvido_em = new Date().toISOString();
        console.log('✅ Marcando ticket como resolvido em:', updatePayload.resolvido_em);
      }
    } else {
      console.log('↕️ Only reordering within same column');
    }

    // Update ticket (triggers will handle validation and audit)
    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticketId)
      .select('id, status, position, updated_at, resolvido_em')
      .single();

    if (updateError) {
      console.error('❌ Failed to update ticket:', updateError);
      return new Response(JSON.stringify({ 
        error: updateError.message,
        details: updateError.details || 'Verifique as permissões e regras de transição'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Ticket updated successfully:', updatedTicket.id);

    // Se o ticket foi marcado como concluído, disparar moderação
    if (toStatus === 'concluido' && toStatus !== currentTicket.status) {
      console.log('🎯 Ticket concluído, disparando moderação...');
      
      try {
        // Buscar dados completos do ticket incluindo a conversa JSON
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select('descricao_problema, conversa')
          .eq('id', ticketId)
          .single();

        if (!ticketError && ticketData) {
          // Processar conversa do JSON
          let conversaTexto = '';
          
          if (ticketData.conversa && Array.isArray(ticketData.conversa)) {
            conversaTexto = ticketData.conversa
              .map((msg: any) => {
                const autor = msg.autor || msg.role || 'desconhecido';
                const texto = msg.texto || msg.content || msg.mensagem || '';
                return `[${autor.toUpperCase()}]: ${texto}`;
              })
              .join('\n\n');
          } else if (ticketData.conversa && typeof ticketData.conversa === 'string') {
            conversaTexto = ticketData.conversa;
          }

          if (conversaTexto.trim()) {
            console.log('📝 Conversa capturada para moderação:', conversaTexto.substring(0, 200) + '...');
            
            // PRIMEIRO: Criar entrada pendente para mostrar na UI
            const { data: aprovacaoPendente, error: pendingError } = await supabase
              .from('knowledge_auto_approvals')
              .insert({
                original_message: `${ticketData.descricao_problema}\n\n${conversaTexto}`,
                corrected_response: 'Processando...',
                documentation_content: 'Analisando conteúdo...',
                similar_documents: [],
                ticket_id: ticketId,
                status: 'pending',
                ai_evaluation: { processando: true }
              })
              .select()
              .single();

            if (pendingError) {
              console.error('❌ Erro ao criar entrada pendente:', pendingError);
            } else {
              console.log('✅ Entrada pendente criada:', aprovacaoPendente.id);
              
              // SEGUNDO: Chamar edge function de moderação em background
              try {
                const { data: moderationResult, error: moderationError } = await supabase.functions.invoke('ticket-completion-moderator', {
                  body: {
                    ticket_id: ticketId,
                    conversa: conversaTexto,
                    problema: ticketData.descricao_problema,
                    approval_id: aprovacaoPendente.id
                  }
                });

                if (moderationError) {
                  console.error('❌ Erro na moderação:', moderationError);
                } else {
                  console.log('✅ Moderação disparada com sucesso');
                }
              } catch (moderationErr) {
                console.error('❌ Erro ao disparar moderação:', moderationErr);
              }
            }
          } else {
            console.log('⚠️ Conversa vazia, não disparando moderação');
          }
        } else {
          console.error('❌ Erro ao buscar dados do ticket:', ticketError);
        }
      } catch (moderationError) {
        console.error('💥 Erro geral na moderação:', moderationError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      ticket: updatedTicket,
      message: toStatus !== currentTicket.status ? 
        `Ticket movido para ${toStatus}` : 
        'Ordem atualizada'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});