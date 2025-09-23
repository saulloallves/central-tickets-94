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
    const ticketData = await req.json();
    console.log('🎫 Creating ticket with data:', ticketData);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role for admin operations, but pass user auth for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { 
        headers: { 
          Authorization: req.headers.get('Authorization') ?? ''
        } 
      },
    });

    // Validate required fields
    if (!ticketData.unidade_id || !ticketData.descricao_problema) {
      return new Response(JSON.stringify({ 
        error: 'unidade_id e descricao_problema são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get auth user from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token de autenticação necessário' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract user ID from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile to establish relationships
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    let colaborador_id = null;
    if (profile?.email) {
      const { data: colaborador } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('email', profile.email)
        .single();
      
      if (colaborador) {
        colaborador_id = colaborador.id;
      }
    }

    // Resolve team name to ID if provided
    let finalTeamId = ticketData.equipe_responsavel_id || null;
    
    if (ticketData.equipe_responsavel_nome && !finalTeamId) {
      console.log('🔍 Resolving team name to ID:', ticketData.equipe_responsavel_nome);
      
      // First try exact match
      let { data: equipe } = await supabase
        .from('equipes')
        .select('id, nome')
        .eq('ativo', true)
        .ilike('nome', ticketData.equipe_responsavel_nome)
        .maybeSingle();
      
      // If not found, try partial match
      if (!equipe) {
        const { data: equipes } = await supabase
          .from('equipes')
          .select('id, nome')
          .eq('ativo', true)
          .ilike('nome', `%${ticketData.equipe_responsavel_nome}%`)
          .limit(1);
        
        equipe = equipes?.[0] || null;
      }
      
      if (equipe) {
        finalTeamId = equipe.id;
        console.log('✅ Team found:', equipe.nome, '(ID:', equipe.id, ')');
      } else {
        return new Response(JSON.stringify({ 
          error: `Equipe "${ticketData.equipe_responsavel_nome}" não encontrada ou inativa` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate and normalize priority
    const validPriorities = ['baixo', 'medio', 'alto', 'imediato', 'crise'];
    let finalPriority = ticketData.prioridade || 'baixo';
    
    if (!validPriorities.includes(finalPriority)) {
      console.warn(`Invalid priority "${finalPriority}", using default`);
      finalPriority = 'baixo';
    }

    // Prepare ticket data
    const ticketInsertData = {
      unidade_id: ticketData.unidade_id,
      descricao_problema: ticketData.descricao_problema,
      titulo: ticketData.titulo || null,
      canal_origem: ticketData.canal_origem || 'web',
      categoria: ticketData.categoria || null,
      subcategoria: ticketData.subcategoria || null,
      prioridade: finalPriority,
      status: 'aberto',
      criado_por: user.id,
      colaborador_id,
      equipe_responsavel_id: finalTeamId,
      arquivos: ticketData.arquivos || [],
      log_ia: {},
      conversa: [],
      reaberto_count: 0,
      status_sla: 'dentro_prazo'
    };

    console.log('📝 Final ticket data for insert:', ticketInsertData);

    // Insert ticket
    const { data: newTicket, error: insertError } = await supabase
      .from('tickets')
      .insert(ticketInsertData)
      .select(`
        *,
        equipes!equipe_responsavel_id(nome),
        unidades(id, grupo, cidade, uf),
        colaboradores(nome_completo)
      `)
      .single();

    if (insertError) {
      console.error('❌ Failed to insert ticket:', insertError);
      return new Response(JSON.stringify({ 
        error: insertError.message,
        details: insertError.details || 'Erro ao criar ticket'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Ticket created successfully:', newTicket.codigo_ticket);

    // Enviar notificação de ticket criado imediatamente
    try {
      console.log('📤 Enviando notificação de ticket criado...');
      
      const notificationResult = await fetch(`${supabaseUrl}/functions/v1/process-notifications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: newTicket.id,
          type: 'ticket_created',
          payload: {
            unidade_id: newTicket.unidade_id,
            codigo_ticket: newTicket.codigo_ticket,
            categoria: newTicket.categoria,
            prioridade: newTicket.prioridade
          }
        })
      });

      if (notificationResult.ok) {
        const notificationData = await notificationResult.json();
        console.log('✅ Notificação de ticket criado enviada:', notificationData);
      } else {
        console.error('❌ Erro ao enviar notificação:', await notificationResult.text());
      }
    } catch (notificationError) {
      console.error('❌ Erro ao processar notificação:', notificationError);
      // Continue sem falhar a criação do ticket
    }

    // Call crisis AI analyst after ticket creation (if has team)
    if (newTicket.equipe_responsavel_id) {
      try {
        console.log('Calling crisis AI analyst for ticket:', newTicket.id);
        
        const analystResponse = await fetch(`${supabaseUrl}/functions/v1/crises-ai-analyst`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticket_id: newTicket.id,
            titulo: newTicket.titulo,
            descricao_problema: newTicket.descricao_problema,
            equipe_id: newTicket.equipe_responsavel_id,
            categoria: newTicket.categoria
          })
        });

        if (analystResponse.ok) {
          const analysisResult = await analystResponse.json();
          console.log('Crisis analysis result:', analysisResult);
        } else {
          console.error('Crisis analyst failed:', await analystResponse.text());
        }
      } catch (analystError) {
        console.error('Error calling crisis analyst:', analystError);
        // Continue without failing ticket creation
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      ticket: newTicket,
      message: `Ticket ${newTicket.codigo_ticket} criado com sucesso`
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