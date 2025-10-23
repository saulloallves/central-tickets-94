import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DirectTicketRequest {
  titulo: string;
  descricao_problema: string;
  unidade_id: string;
  equipe_id?: string;
  prioridade?: 'baixo' | 'medio' | 'alto' | 'imediato' | 'crise';
  categoria?: string;
  franqueado_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body: DirectTicketRequest = await req.json();
    
    console.log('[create-ticket-direct] Received request:', {
      titulo: body.titulo,
      unidade_id: body.unidade_id,
      prioridade: body.prioridade,
    });

    // Validate required fields
    if (!body.titulo || !body.descricao_problema || !body.unidade_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Campos obrigatórios: titulo, descricao_problema, unidade_id',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate priority if provided
    const validPriorities = ['baixo', 'medio', 'alto', 'imediato', 'crise'];
    const prioridade = body.prioridade && validPriorities.includes(body.prioridade)
      ? body.prioridade
      : 'baixo';

    if (body.prioridade && !validPriorities.includes(body.prioridade)) {
      console.warn(`[create-ticket-direct] Invalid priority "${body.prioridade}", using "baixo"`);
    }

    // Prepare ticket data
    const ticketData: any = {
      titulo: body.titulo,
      descricao_problema: body.descricao_problema,
      unidade_id: body.unidade_id,
      prioridade: prioridade,
      status: 'aberto',
      data_abertura: new Date().toISOString(),
    };

    // Add optional fields if provided
    if (body.equipe_id) {
      ticketData.equipe_id = body.equipe_id;
    }
    if (body.categoria) {
      ticketData.categoria = body.categoria;
    }
    if (body.franqueado_id) {
      ticketData.franqueado_id = body.franqueado_id;
    }

    console.log('[create-ticket-direct] Creating ticket:', ticketData);

    // Insert ticket directly into database
    const { data: ticket, error: insertError } = await supabase
      .from('tickets')
      .insert([ticketData])
      .select()
      .single();

    if (insertError) {
      console.error('[create-ticket-direct] Error creating ticket:', insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao criar ticket',
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[create-ticket-direct] Ticket created successfully:', ticket.id);

    // Add initial message
    const { error: messageError } = await supabase
      .from('ticket_messages')
      .insert([{
        ticket_id: ticket.id,
        mensagem: body.descricao_problema,
        origem: 'sistema',
        created_at: new Date().toISOString(),
      }]);

    if (messageError) {
      console.warn('[create-ticket-direct] Error adding initial message:', messageError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticket,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[create-ticket-direct] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro inesperado ao criar ticket',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
