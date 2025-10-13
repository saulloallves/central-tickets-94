import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting process of pending notifications...');

    // ✅ ATOMIC UPDATE: Get and mark as 'processing' atomically to prevent duplicates
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notifications_queue')
      .update({ status: 'processing' })
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10)
      .select();

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${pendingNotifications?.length || 0} pending notifications`);

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending notifications to process',
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
        console.log(`Processing notification ${notification.id} of type ${notification.type}`);

        // Call the process-notifications function for each notification
        const { data: processResult, error: processError } = await supabase.functions.invoke(
          'process-notifications',
          {
            body: {
              ticketId: notification.ticket_id,
              type: notification.type,
              payload: notification.payload
            }
          }
        );

        if (processError) {
          console.error(`Error processing notification ${notification.id}:`, processError);
          errors.push({
            notificationId: notification.id,
            error: processError.message
          });
          continue;
        }

        console.log(`Successfully processed notification ${notification.id}`);

        // Mark as sent (successful processing)
        await supabase
          .from('notifications_queue')
          .update({ 
            status: 'sent', 
            processed_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        processedCount++;

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        
        // Return to pending on error
        await supabase
          .from('notifications_queue')
          .update({ status: 'pending' })
          .eq('id', notification.id);
        
        errors.push({
          notificationId: notification.id,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${processedCount} notifications`,
        processed: processedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in process-pending-notifications:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to process pending notifications',
        details: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});