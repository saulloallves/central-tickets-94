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
    
    // Use service role for admin operations, but pass user auth for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { 
        headers: { 
          Authorization: req.headers.get('Authorization') ?? ''
        } 
      },
    });

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
    const updatePayload: Record<string, any> = {
      position: newPosition,
      updated_at: new Date().toISOString(),
    };

    // Only update status if it's actually changing
    if (toStatus !== currentTicket.status) {
      updatePayload.status = toStatus;
      console.log('🔄 Status changing from', currentTicket.status, 'to', toStatus);
    } else {
      console.log('↕️ Only reordering within same column');
    }

    // Update ticket (triggers will handle validation and audit)
    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticketId)
      .select(`
        *,
        unidades:unidade_id (
          id,
          grupo
        ),
        equipes:equipe_responsavel_id (
          id,
          nome
        ),
        atendimento_iniciado_por_profile:atendimento_iniciado_por (
          nome_completo
        ),
        colaboradores (
          nome_completo
        ),
        created_by_profile:criado_por (
          nome_completo
        )
      `)
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