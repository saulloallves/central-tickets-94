import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testando notificação de franqueado...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar um ticket de teste
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, codigo_ticket, equipe_responsavel_id, franqueado_nome')
      .limit(1)
      .single();

    if (!ticket) {
      throw new Error('Nenhum ticket encontrado para teste');
    }

    console.log('📋 Ticket de teste:', ticket.codigo_ticket);

    // Simular chamada do typebot-ticket-message
    const typebotResponse = await supabase.functions.invoke('typebot-ticket-message', {
      body: {
        ticketId: ticket.id,
        texto: 'Esta é uma mensagem de teste do franqueado!'
      }
    });

    console.log('🔔 Resposta typebot:', typebotResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        ticket_id: ticket.id,
        ticket_code: ticket.codigo_ticket,
        typebot_response: typebotResponse
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});