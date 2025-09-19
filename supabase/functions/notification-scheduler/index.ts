
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running notification scheduler...');

    // Buscar notificações pendentes que já deveriam ter sido enviadas
    const { data: pendingNotifications, error } = await supabase
      .from('notifications_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('scheduled_at', new Date().toISOString())
      .limit(50);

    if (error) {
      throw error;
    }

    console.log(`Found ${pendingNotifications?.length || 0} pending notifications`);

    // Check for SLA breaches and escalate overdue tickets
    const { data: overdueTickets } = await supabase
      .from('tickets')
      .select('*')
      .eq('status_sla', 'vencido')
      .neq('status', 'concluido')
      .not('status', 'eq', 'escalonado');

    if (overdueTickets && overdueTickets.length > 0) {
      console.log(`Found ${overdueTickets.length} overdue tickets for escalation`);
      
      for (const ticket of overdueTickets) {
        // Escalate ticket to "escalonado" status
        const { error: escalateError } = await supabase
          .from('tickets')
          .update({ 
            status: 'escalonado',
            escalonamento_nivel: (ticket.escalonamento_nivel || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticket.id);

        if (escalateError) {
          console.error(`Error escalating ticket ${ticket.codigo_ticket}:`, escalateError);
        } else {
          console.log(`Escalated ticket ${ticket.codigo_ticket} due to SLA breach`);
          
          // Log the escalation action
          await supabase
            .rpc('log_system_action', {
              p_tipo_log: 'sistema',
              p_entidade_afetada: 'tickets',
              p_entidade_id: ticket.id,
              p_acao_realizada: 'Ticket escalado automaticamente por vencimento de SLA',
              p_canal: 'sistema_automatico'
            });
        }

        // Check if SLA breach notification already exists
        const { data: existingNotification } = await supabase
          .from('notifications_queue')
          .select('id')
          .eq('ticket_id', ticket.id)
          .eq('type', 'sla_breach')
          .maybeSingle();

        if (!existingNotification) {
          console.log(`Queueing SLA breach notification for ticket ${ticket.codigo_ticket}`);
          await supabase
            .from('notifications_queue')
            .insert({
              ticket_id: ticket.id,
              type: 'sla_breach',
              payload: {
                unidade_id: ticket.unidade_id,
                codigo_ticket: ticket.codigo_ticket,
                escalated: true
              }
            });
        }
      }
    }

    // Processar cada notificação
    for (const notification of pendingNotifications || []) {
      try {
        // Atualizar status para processing
        await supabase
          .from('notifications_queue')
          .update({ status: 'processing' })
          .eq('id', notification.id);

        // Chamar função de processamento
        const { error: processError } = await supabase.functions.invoke('process-notifications', {
          body: {
            ticketId: notification.ticket_id,
            type: notification.type,
            ...notification.payload
          },
          headers: {
            'x-notification-id': notification.id
          }
        });

        if (processError) {
          console.error('Error processing notification:', processError);
          
          // Incrementar tentativas
          const newAttempts = notification.attempts + 1;
          
          if (newAttempts >= 3) {
            // Marcar como failed após 3 tentativas
            await supabase
              .from('notifications_queue')
              .update({ 
                status: 'failed',
                attempts: newAttempts,
                processed_at: new Date().toISOString()
              })
              .eq('id', notification.id);
          } else {
            // Reagendar para tentar novamente em 5 minutos
            const nextAttempt = new Date(Date.now() + 5 * 60 * 1000);
            await supabase
              .from('notifications_queue')
              .update({ 
                status: 'pending',
                attempts: newAttempts,
                scheduled_at: nextAttempt.toISOString()
              })
              .eq('id', notification.id);
          }
        } else {
          // Marcar como enviada com sucesso
          await supabase
            .from('notifications_queue')
            .update({ 
              status: 'sent',
              processed_at: new Date().toISOString()
            })
            .eq('id', notification.id);
        }
      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: pendingNotifications?.length || 0 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in notification scheduler:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
