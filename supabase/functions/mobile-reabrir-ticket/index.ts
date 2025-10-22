import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, senha_web, sla_minutos = 240 } = await req.json();

    console.log('🔄 Tentando reabrir ticket:', ticketId);

    // Validar parâmetros
    if (!ticketId || !senha_web) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ticketId e senha_web são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Criar cliente Supabase com SERVICE_ROLE_KEY (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Validar senha_web e buscar franqueado
    const { data: franqueado, error: franqueadoError } = await supabase
      .from('franqueados')
      .select('id, name, phone')
      .eq('web_password', senha_web)
      .single();

    if (franqueadoError || !franqueado) {
      console.error('❌ Senha web inválida');
      return new Response(
        JSON.stringify({ ok: false, error: 'Senha web inválida' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('✅ Franqueado validado:', franqueado.name);

    // 2. Buscar ticket e validar propriedade
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('❌ Ticket não encontrado');
      return new Response(
        JSON.stringify({ ok: false, error: 'Ticket não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verificar se ticket pertence ao franqueado
    if (ticket.franqueado_id !== franqueado.id) {
      console.error('❌ Ticket não pertence ao franqueado');
      return new Response(
        JSON.stringify({ ok: false, error: 'Você não tem permissão para reabrir este ticket' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Verificar status (concluido ou escalonado)
    if (!['concluido', 'escalonado'].includes(ticket.status)) {
      console.error('❌ Status inválido:', ticket.status);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: `Ticket não pode ser reaberto (status atual: ${ticket.status})` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('✅ Validações passaram, reabrindo ticket...');

    // 3. Calcular nova data limite SLA
    const now = new Date();
    const dataLimiteSLA = new Date(now.getTime() + sla_minutos * 60000);

    // 4. Atualizar ticket (com SERVICE_ROLE_KEY, bypass RLS)
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'aberto',
        status_sla: 'dentro_prazo',
        data_limite_sla: dataLimiteSLA.toISOString(),
        sla_minutos_restantes: sla_minutos,
        sla_pausado_horario: false,
        reaberto_count: (ticket.reaberto_count || 0) + 1,
        resolvido_em: null,
        updated_at: now.toISOString()
      })
      .eq('id', ticketId);

    if (updateError) {
      console.error('❌ Erro ao atualizar ticket:', updateError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Erro ao atualizar ticket' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 5. Inserir mensagem de sistema
    const { error: messageError } = await supabase
      .from('ticket_mensagens')
      .insert({
        ticket_id: ticketId,
        mensagem: `🔄 Ticket reaberto pelo franqueado.\nNovo SLA: ${sla_minutos} minutos (${(sla_minutos/60).toFixed(1)}h)\nPrazo: ${dataLimiteSLA.toLocaleDateString('pt-BR')} às ${dataLimiteSLA.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        direcao: 'saida',
        canal: 'web'
      });

    if (messageError) {
      console.error('⚠️ Erro ao inserir mensagem:', messageError);
      // Não falhar a operação por causa da mensagem
    }

    console.log('✅ Ticket reaberto com sucesso');

    return new Response(
      JSON.stringify({ 
        ok: true, 
        ticket_id: ticketId,
        novo_prazo: dataLimiteSLA.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Erro ao reabrir ticket' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
