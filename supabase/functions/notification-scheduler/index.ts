
// Using native Deno.serve (no import needed)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
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

    // Escalonamento agora é feito pela função process_overdue_slas() no sla-processor
    // Aqui apenas processamos a fila de notificações

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
