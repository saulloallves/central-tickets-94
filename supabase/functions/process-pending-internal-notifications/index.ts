// Using native Deno.serve (no import needed)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting retroactive processing of pending ticket_forwarded notifications...');

    // Get all pending ticket_forwarded notifications
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notifications_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('type', 'ticket_forwarded')
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${pendingNotifications?.length || 0} pending ticket_forwarded notifications`);

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending ticket_forwarded notifications to process',
          processed: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    let processedCount = 0;
    let errors: any[] = [];

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        console.log(`Processing notification ${notification.id} for ticket ${notification.ticket_id}`);

        const payload = notification.payload as any;
        const equipeId = payload?.equipe_id;

        if (!equipeId) {
          console.warn(`Notification ${notification.id} has no equipe_id in payload, skipping`);
          continue;
        }

        // Get active team members
        const { data: teamMembers, error: teamError } = await supabase
          .from('equipe_members')
          .select('user_id')
          .eq('equipe_id', equipeId)
          .eq('ativo', true);

        if (teamError) {
          console.error(`Error fetching team members for ${equipeId}:`, teamError);
          errors.push({
            notificationId: notification.id,
            error: teamError.message
          });
          continue;
        }

        if (!teamMembers || teamMembers.length === 0) {
          console.warn(`No active team members found for equipe ${equipeId}`);
          continue;
        }

        // Create internal notification
        const { data: internalNotification, error: notifError } = await supabase
          .from('internal_notifications')
          .insert({
            title: `Novo ticket encaminhado: ${payload.codigo_ticket || 'Sem código'}`,
            message: `Ticket "${payload.titulo || 'Sem título'}" foi encaminhado para sua equipe`,
            type: 'ticket_forwarded',
            priority: payload.prioridade || 'medio',
            ticket_id: notification.ticket_id,
            metadata: {
              equipe_id: equipeId,
              codigo_ticket: payload.codigo_ticket,
              categoria: payload.categoria,
              unidade_id: payload.unidade_id
            }
          })
          .select()
          .single();

        if (notifError) {
          console.error(`Error creating internal notification:`, notifError);
          errors.push({
            notificationId: notification.id,
            error: notifError.message
          });
          continue;
        }

        // Create recipients for all team members
        const recipients = teamMembers.map(member => ({
          notification_id: internalNotification.id,
          user_id: member.user_id,
          is_read: false
        }));

        const { error: recipientsError } = await supabase
          .from('internal_notification_recipients')
          .insert(recipients);

        if (recipientsError) {
          console.error(`Error creating recipients:`, recipientsError);
          errors.push({
            notificationId: notification.id,
            error: recipientsError.message
          });
          continue;
        }

        // Mark original notification as processed
        await supabase
          .from('notifications_queue')
          .update({ 
            status: 'processed',
            processed_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        console.log(`Successfully processed notification ${notification.id} - created for ${teamMembers.length} team members`);
        processedCount++;

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        errors.push({
          notificationId: notification.id,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processadas ${processedCount} notificações retroativamente`,
        processed: processedCount,
        total: pendingNotifications.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in process-pending-internal-notifications:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to process pending internal notifications',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
