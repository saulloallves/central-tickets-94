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
    console.log('typebot-ticket-message: Recebendo requisição', req.method, req.url);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json();
    console.log('typebot-ticket-message: Body recebido:', body);

    // Validate required fields
    if (!body.ticketId || !body.texto) {
      console.error('typebot-ticket-message: Campos obrigatórios ausentes:', { ticketId: body.ticketId, texto: body.texto });
      return new Response(
        JSON.stringify({ error: 'ticketId e texto são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      ticketId,
      texto,
      canal = 'typebot',
      autor = 'franqueado',
      usuarioId = null
    } = body;

    // Verify ticket exists and get complete data for notification
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        id, 
        codigo_ticket, 
        equipe_responsavel_id,
        unidade_id,
        status,
        prioridade,
        titulo,
        data_abertura,
        updated_at
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('typebot-ticket-message: Ticket não encontrado:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('typebot-ticket-message: Ticket encontrado:', ticket.codigo_ticket);

    // Insert message directly into ticket_mensagens table
    const { data: mensagemResult, error: mensagemError } = await supabase
      .from('ticket_mensagens')
      .insert({
        ticket_id: ticketId,
        usuario_id: usuarioId,
        mensagem: texto,
        direcao: 'entrada', // Messages from typebot are always incoming
        canal: canal,
        anexos: []
      })
      .select()
      .single();

    if (mensagemError) {
      console.error('typebot-ticket-message: Erro ao adicionar mensagem:', mensagemError);
      return new Response(
        JSON.stringify({ error: 'Erro ao adicionar mensagem ao ticket' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('typebot-ticket-message: Mensagem adicionada com sucesso');

    // Criar notificação interna no sistema para emitir som e alerta
    try {
      console.log('🔔 Criando notificação interna no sistema...');
      console.log('🎯 Equipe responsável:', ticket.equipe_responsavel_id);
      
      const internalNotificationResult = await supabase.functions.invoke('create-internal-notification', {
        body: {
          type: 'franqueado_respondeu',
          title: 'Franqueado Respondeu!',
          message: `Franqueado respondeu o ticket ${ticket.codigo_ticket}`,
          equipe_id: ticket.equipe_responsavel_id,
          payload: {
            ticket_id: ticketId,
            codigo_ticket: ticket.codigo_ticket,
            texto_resposta: texto
          }
        }
      });

      if (internalNotificationResult.error) {
        console.error('❌ Erro ao criar notificação interna:', internalNotificationResult.error);
      } else {
        console.log('✅ Notificação interna criada com sucesso:', internalNotificationResult.data);
      }
    } catch (internalError) {
      console.error('❌ Falha ao criar notificação interna:', internalError);
      // Não falhar a operação principal por causa da notificação
    }

    // Também adicionar à fila de notificações para garantir que chegue
    try {
      console.log('🔔 Adicionando notificação à fila...');
      
      const { error: queueError } = await supabase
        .from('notifications_queue')
        .insert({
          type: 'franqueado_respondeu',
          ticket_id: ticketId,
          payload: {
            ticket_id: ticketId,
            codigo_ticket: ticket.codigo_ticket,
            texto_resposta: texto
          },
          status: 'pending'
        });

      if (queueError) {
        console.error('❌ Erro ao adicionar à fila:', queueError);
      } else {
        console.log('✅ Notificação adicionada à fila com sucesso');
      }
    } catch (queueError) {
      console.error('❌ Falha ao adicionar à fila:', queueError);
    }

    const lastMessage = mensagemResult;

    const response = {
      ok: true,
      ticketId: ticketId,
      codigo_ticket: ticket.codigo_ticket,
      added: lastMessage,
      notification_sent: true
    };

    console.log('typebot-ticket-message: Resposta enviada com sucesso');

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('typebot-ticket-message: Erro geral:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});