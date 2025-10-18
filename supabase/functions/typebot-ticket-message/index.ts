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
    console.log('typebot-ticket-message: Recebendo requisição', req.method, req.url);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('typebot-ticket-message: Body recebido:', body);

    const {
      ticketId,
      texto,
      senha_web,
      canal = 'typebot',
      autor = 'franqueado',
      usuarioId = null,
      anexos = []
    } = body;

    if (!ticketId) {
      console.error('typebot-ticket-message: ticketId ausente');
      return new Response(
        JSON.stringify({ error: 'ticketId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!texto && (!anexos || anexos.length === 0)) {
      console.error('typebot-ticket-message: Nenhum conteúdo fornecido');
      return new Response(
        JSON.stringify({ error: 'Forneça texto ou anexos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar franqueado APENAS se senha_web foi fornecida
    let franqueadoNome = null;
    if (senha_web) {
      const { data: franqueado, error: franqueadoError } = await supabase
        .from('franqueados')
        .select('name')
        .eq('web_password', senha_web)
        .maybeSingle();

      if (franqueado) {
        franqueadoNome = franqueado.name;
        console.log('typebot-ticket-message: Franqueado autenticado:', franqueadoNome);
      } else {
        console.log('typebot-ticket-message: Senha inválida, processando sem nome de franqueado');
      }
    } else {
      console.log('typebot-ticket-message: Processando sem autenticação de franqueado');
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, codigo_ticket, equipe_responsavel_id, unidade_id, status, prioridade, titulo, data_abertura, updated_at, unidades!inner(grupo)')
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

    // Montar mensagem com ou sem nome do franqueado
    // Se for canal 'typebot' (mobile), não adiciona o nome
    const mensagemTexto = (franqueadoNome && canal !== 'typebot') ? `[${franqueadoNome}]: ${texto}` : texto;
    
    // Inserir mensagem diretamente na tabela ticket_mensagens para incluir anexos
    const { error: insertError } = await supabase
      .from('ticket_mensagens')
      .insert({
        ticket_id: ticketId,
        mensagem: mensagemTexto || '[Anexo enviado]',
        direcao: 'entrada',
        canal: canal || 'typebot',
        usuario_id: usuarioId,
        anexos: anexos
      });

    if (insertError) {
      console.error('typebot-ticket-message: Erro ao inserir mensagem:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao adicionar mensagem ao ticket' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('typebot-ticket-message: Mensagem inserida na tabela ticket_mensagens');

    console.log('typebot-ticket-message: Mensagem adicionada com sucesso');

    try {
      console.log('🔔 Criando notificação interna no sistema...');
      console.log('🎯 Equipe responsável:', ticket.equipe_responsavel_id);
      
      const internalNotificationResult = await supabase.functions.invoke('create-internal-notification', {
        body: {
          type: 'franqueado_respondeu',
          title: 'Franqueado Respondeu!',
          message: `Franqueado respondeu o ticket ${ticket.titulo || ticket.codigo_ticket}`,
          equipe_id: ticket.equipe_responsavel_id,
          payload: {
            ticket_id: ticketId,
            codigo_ticket: ticket.codigo_ticket,
            titulo_ticket: ticket.titulo,
            unidade_nome: ticket.unidades?.grupo,
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
    }

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
            titulo_ticket: ticket.titulo,
            unidade_nome: ticket.unidades?.grupo,
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

    const response = {
      ok: true,
      ticketId: ticketId,
      codigo_ticket: ticket.codigo_ticket,
      message: 'Mensagem adicionada com sucesso',
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
