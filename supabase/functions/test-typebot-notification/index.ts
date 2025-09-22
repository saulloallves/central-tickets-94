import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Iniciando teste de notificação Typebot...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar um ticket existente para teste
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, codigo_ticket, equipe_responsavel_id')
      .limit(1);

    if (ticketsError || !tickets || tickets.length === 0) {
      throw new Error('Nenhum ticket encontrado para teste');
    }

    const testTicket = tickets[0];
    console.log('📋 Usando ticket para teste:', testTicket.codigo_ticket);

    // Simular resposta de franqueado via Typebot
    const testResponse = await supabase.functions.invoke('typebot-ticket-message', {
      body: {
        ticketId: testTicket.id,
        texto: 'Esta é uma resposta de teste do franqueado via Typebot. Por favor, verificar se a notificação foi enviada corretamente.',
        canal: 'typebot',
        autor: 'franqueado'
      }
    });

    console.log('🔄 Resposta da function typebot-ticket-message:', testResponse);

    if (testResponse.error) {
      throw new Error(`Erro na function typebot-ticket-message: ${JSON.stringify(testResponse.error)}`);
    }

    // Verificar se a mensagem foi inserida
    const { data: mensagens, error: mensagensError } = await supabase
      .from('ticket_mensagens')
      .select('*')
      .eq('ticket_id', testTicket.id)
      .eq('direcao', 'entrada')
      .order('created_at', { ascending: false })
      .limit(1);

    if (mensagensError) {
      throw new Error(`Erro ao verificar mensagens: ${mensagensError.message}`);
    }

    console.log('📨 Última mensagem inserida:', mensagens?.[0]);

    // Verificar template de notificação
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('*')
      .eq('key', 'resposta_ticket_franqueado')
      .single();

    if (templateError) {
      console.warn('⚠️ Template resposta_ticket_franqueado não encontrado:', templateError);
    } else {
      console.log('📋 Template encontrado:', template);
    }

    const result = {
      success: true,
      ticket_usado: testTicket,
      typebot_response: testResponse.data,
      mensagem_inserida: mensagens?.[0],
      template_existe: !!template,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Teste concluído com sucesso!');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});