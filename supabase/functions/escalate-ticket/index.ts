import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { ticket_id, reason = 'SLA vencido' } = await req.json();

    if (!ticket_id) {
      return new Response(JSON.stringify({ error: 'ticket_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🚨 Iniciando escalonamento do ticket: ${ticket_id} - Motivo: ${reason}`);

    // 1. Buscar dados do ticket atual
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('Erro ao buscar ticket:', ticketError);
      return new Response(JSON.stringify({ error: 'Ticket não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Ticket encontrado: ${ticket.codigo_ticket} - Status atual: ${ticket.status}`);

    // 2. Verificar se o ticket já está concluído (não escalonar se estiver)
    if (ticket.status === 'concluido') {
      console.log('⚠️ Ticket já está concluído, não será escalonado');
      return new Response(JSON.stringify({ 
        message: 'Ticket já está concluído',
        ticket_id,
        action: 'none'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Calcular novo nível de escalonamento
    const novoNivelEscalonamento = (ticket.escalonamento_nivel || 0) + 1;
    
    console.log(`📈 Escalonando para nível: ${novoNivelEscalonamento}`);

    // 4. Atualizar status do ticket para escalonado
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'escalonado',
        escalonamento_nivel: novoNivelEscalonamento,
        status_sla: 'vencido',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticket_id);

    if (updateError) {
      console.error('Erro ao atualizar ticket:', updateError);
      return new Response(JSON.stringify({ error: 'Erro ao escalonar ticket' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Ticket ${ticket.codigo_ticket} escalonado com sucesso para nível ${novoNivelEscalonamento}`);

    // 5. Criar notificação de SLA vencido se não existir
    const { error: notificationError } = await supabase
      .from('notifications_queue')
      .insert({
        ticket_id: ticket_id,
        type: 'sla_breach',
        alert_level: 'critical',
        alert_category: 'sla',
        payload: {
          codigo_ticket: ticket.codigo_ticket,
          unidade_id: ticket.unidade_id,
          sla_vencido_em: ticket.data_limite_sla,
          escalonamento_nivel: novoNivelEscalonamento,
          motivo: reason,
          escalated_at: new Date().toISOString()
        },
        status: 'pending'
      });

    if (notificationError) {
      console.error('Erro ao criar notificação:', notificationError);
      // Não falha a operação, apenas loga o erro
    } else {
      console.log('📤 Notificação de SLA vencido criada');
    }

    // 6. Chamar o processador de notificações para enviar imediatamente
    try {
      const { error: processError } = await supabase.functions.invoke('process-notifications', {
        body: { 
          ticket_id: ticket_id,
          type: 'sla_breach',
          force_process: true
        }
      });

      if (processError) {
        console.error('Erro ao processar notificações:', processError);
      } else {
        console.log('📨 Notificações processadas com sucesso');
      }
    } catch (error) {
      console.error('Erro ao chamar process-notifications:', error);
      // Não falha a operação principal
    }

    // 7. Log da ação no sistema
    const { error: logError } = await supabase.rpc('log_sla_action', {
      p_ticket_id: ticket_id,
      p_action: `Ticket escalonado automaticamente - Nível ${novoNivelEscalonamento}`,
      p_details: {
        motivo: reason,
        nivel_anterior: ticket.escalonamento_nivel || 0,
        nivel_atual: novoNivelEscalonamento,
        sla_vencido_em: ticket.data_limite_sla,
        escalated_at: new Date().toISOString(),
        automatico: true
      }
    });

    if (logError) {
      console.error('Erro ao criar log:', logError);
    }

    // 8. Buscar configurações de escalonamento para este nível
    const { data: escalationConfig } = await supabase
      .from('escalation_levels')
      .select('*')
      .eq('unidade_id', ticket.unidade_id)
      .eq('ordem', novoNivelEscalonamento)
      .eq('ativo', true)
      .maybeSingle();

    if (escalationConfig) {
      console.log(`🎯 Configuração de escalonamento encontrada para nível ${novoNivelEscalonamento}`);
      
      // Criar notificação específica para o nível de escalonamento
      const { error: escalationNotificationError } = await supabase
        .from('notifications_queue')
        .insert({
          ticket_id: ticket_id,
          type: 'escalation',
          alert_level: 'high',
          alert_category: 'sla',
          payload: {
            codigo_ticket: ticket.codigo_ticket,
            unidade_id: ticket.unidade_id,
            escalonamento_nivel: novoNivelEscalonamento,
            destino_user_id: escalationConfig.destino_user_id,
            destino_whatsapp: escalationConfig.destino_whatsapp,
            role: escalationConfig.role,
            escalated_at: new Date().toISOString()
          },
          status: 'pending'
        });

      if (escalationNotificationError) {
        console.error('Erro ao criar notificação de escalonamento:', escalationNotificationError);
      } else {
        console.log('📤 Notificação de escalonamento criada');
      }
    }

    const response = {
      success: true,
      ticket_id,
      codigo_ticket: ticket.codigo_ticket,
      status_anterior: ticket.status,
      status_atual: 'escalonado',
      escalonamento_nivel: novoNivelEscalonamento,
      motivo: reason,
      escalated_at: new Date().toISOString(),
      notificacao_criada: !notificationError,
      configuracao_escalonamento: escalationConfig ? true : false
    };

    console.log('🎉 Escalonamento concluído:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no escalonamento:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro interno do servidor',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});