
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, type, priority = 'normal' } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing notification:', type, 'for ticket:', ticketId);

    // Buscar dados do ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error(`Ticket not found: ${ticketError?.message}`);
    }

    // Buscar unidade separadamente para obter id_grupo_branco
    const { data: unidade } = await supabase
      .from('unidades')
      .select('grupo, id, id_grupo_branco')
      .eq('id', ticket.unidade_id)
      .single();


    // Buscar configurações de notificação
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('*')
      .single();

    const notificationSettings = settings || {
      numero_remetente: '',
      delay_mensagem: 2000,
      limite_retentativas: 3,
      modelo_mensagem_sla: ''
    };

    // Determinar destinatários baseado no tipo de notificação
    let recipients = [];
    let message = '';

    switch (type) {
      case 'ticket_criado':
        message = `🎫 *Novo Ticket Criado*\n\n` +
                 `*Código:* ${ticket.codigo_ticket}\n` +
                 `*Unidade:* ${unidade?.grupo || ticket.unidade_id}\n` +
                 `*Prioridade:* ${ticket.prioridade}\n` +
                 `*Problema:* ${ticket.descricao_problema.substring(0, 100)}...\n\n` +
                 `⏰ SLA: ${new Date(ticket.data_limite_sla).toLocaleString('pt-BR')}`;
        
        // Usar id_grupo_branco da unidade para envio
        if (unidade?.id_grupo_branco) {
          recipients = [unidade.id_grupo_branco];
        }
        break;

      case 'sla_half_time':
        message = `⚠️ *Alerta SLA - 50% do Prazo*\n\n` +
                 `*Ticket:* ${ticket.codigo_ticket}\n` +
                 `*Unidade:* ${unidade?.grupo || ticket.unidade_id}\n` +
                 `*Tempo Restante:* ${Math.round((new Date(ticket.data_limite_sla).getTime() - Date.now()) / (1000 * 60 * 60))}h\n\n` +
                 `🔄 Status: ${ticket.status}\n` +
                 `📝 ${ticket.descricao_problema.substring(0, 80)}...`;
        
        if (unidade?.id_grupo_branco) {
          recipients = [unidade.id_grupo_branco];
        }
        break;

      case 'sla_vencido':
        message = `🚨 *SLA VENCIDO!*\n\n` +
                 `*Ticket:* ${ticket.codigo_ticket}\n` +
                 `*Unidade:* ${unidade?.grupo || ticket.unidade_id}\n` +
                 `*Vencido há:* ${Math.round((Date.now() - new Date(ticket.data_limite_sla).getTime()) / (1000 * 60))} min\n\n` +
                 `🔥 AÇÃO NECESSÁRIA IMEDIATA`;
        
        // Escalar automaticamente
        const nextLevel = ticket.escalonamento_nivel + 1;
        await supabase
          .from('tickets')
          .update({ 
            status: 'escalonado',
            escalonamento_nivel: nextLevel
          })
          .eq('id', ticketId);

        // Log do escalonamento
        await supabase
          .from('escalation_logs')
          .insert({
            ticket_id: ticketId,
            event_type: 'sla_vencido',
            from_level: ticket.escalonamento_nivel,
            to_level: nextLevel,
            message: 'Escalado automaticamente por SLA vencido'
          });
        
        if (unidade?.id_grupo_branco) {
          recipients = [unidade.id_grupo_branco];
        }
        break;

      case 'crise_detectada':
        message = `🚨🚨 *CRISE DETECTADA* 🚨🚨\n\n` +
                 `*Ticket:* ${ticket.codigo_ticket}\n` +
                 `*Unidade:* ${unidade?.grupo || ticket.unidade_id}\n` +
                 `*Problema:* ${ticket.descricao_problema}\n\n` +
                 `⚡ ATENDIMENTO IMEDIATO NECESSÁRIO\n` +
                 `📞 CONTATE A UNIDADE AGORA`;
        
        // Para crise, usar grupo da unidade
        if (unidade?.id_grupo_branco) {
          recipients = [unidade.id_grupo_branco];
        }
        break;
    }

    // Enviar notificações via Z-API
    if (recipients.length > 0) {
      await sendWhatsAppNotifications(recipients, message, notificationSettings);
    }

    // Marcar notificação como processada se veio da fila
    if (req.headers.get('x-notification-id')) {
      const notificationId = req.headers.get('x-notification-id');
      await supabase
        .from('notifications_queue')
        .update({ 
          status: 'sent', 
          processed_at: new Date().toISOString() 
        })
        .eq('id', notificationId);
    }

    console.log(`Notification sent to ${recipients.length} recipients`);

    return new Response(JSON.stringify({ 
      success: true, 
      recipients: recipients.length,
      type 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-notifications function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getEscalationRecipients(supabase: any, unidadeId: string, nivel: number, allLevels: boolean = false) {
  const query = supabase
    .from('escalation_levels')
    .select('destino_whatsapp')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true);

  if (allLevels) {
    query.lte('ordem', 5); // Todos os níveis até diretoria
  } else {
    query.eq('ordem', Math.min(nivel, 5));
  }

  const { data } = await query;
  return data?.map((level: any) => level.destino_whatsapp).filter(Boolean) || [];
}

async function sendWhatsAppNotifications(recipients: string[], message: string, settings: any) {
  const zapiBaseUrl = Deno.env.get('ZAPI_BASE_URL');
  const zapiToken = Deno.env.get('ZAPI_TOKEN');
  const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

  if (!zapiBaseUrl || !zapiToken || !zapiClientToken) {
    console.warn('Z-API credentials not configured');
    return;
  }

  // Remove /instances/INSTANCE/token/TOKEN part if present, as we'll construct the full URL
  const baseUrl = zapiBaseUrl.replace(/\/instances\/.*/, '');
  
  for (const recipient of recipients) {
    try {
      const response = await fetch(`${baseUrl}/instances/${zapiToken}/token/${zapiClientToken}/send-text`, {
        method: 'POST',
        headers: {
          'Client-Token': zapiClientToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: recipient,
          message: message,
          delayMessage: Math.floor(settings.delay_mensagem / 1000) || 2 // Convert to seconds
        }),
      });

      const result = await response.json();
      console.log(`WhatsApp sent to ${recipient}:`, result.zaapId ? 'SUCCESS' : 'FAILED', result);

      // Delay entre envios
      if (settings.delay_mensagem > 0) {
        await new Promise(resolve => setTimeout(resolve, settings.delay_mensagem));
      }
    } catch (error) {
      console.error(`Failed to send WhatsApp to ${recipient}:`, error);
    }
  }
}
