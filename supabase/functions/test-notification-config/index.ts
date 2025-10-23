// Using native Deno.serve (no import needed)
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧪 Testando configuração de notificações...');

    // 1. Verificar configuração send_ticket_notification
    const { data: notificationConfig, error: notificationError } = await supabase
      .from('messaging_providers')
      .select('*')
      .eq('provider_name', 'send_ticket_notification')
      .eq('is_active', true)
      .single();

    console.log('📡 Config send_ticket_notification:', {
      found: !!notificationConfig,
      instance_id: notificationConfig?.instance_id,
      is_active: notificationConfig?.is_active,
      error: notificationError?.message
    });

    // 2. Testar processamento de uma notificação pendente
    const { data: pendingNotification } = await supabase
      .from('notifications_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('type', 'ticket_created')
      .limit(1)
      .single();

    let testResult = null;
    if (pendingNotification && notificationConfig) {
      console.log('🎯 Testando notificação:', pendingNotification.id);
      
      try {
        const { data: processResult, error: processError } = await supabase.functions.invoke(
          'process-notifications',
          {
            body: {
              ticketId: pendingNotification.ticket_id,
              type: pendingNotification.type,
              payload: pendingNotification.payload
            }
          }
        );

        testResult = {
          success: !processError,
          result: processResult,
          error: processError?.message
        };

        console.log('✅ Resultado do teste:', testResult);
      } catch (error) {
        testResult = {
          success: false,
          error: error.message
        };
        console.error('❌ Erro no teste:', error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      tests: {
        notification_config: {
          found: !!notificationConfig,
          instance_id: notificationConfig?.instance_id?.substring(0, 8) + '...',
          is_active: notificationConfig?.is_active,
          error: notificationError?.message
        },
        pending_notification: {
          found: !!pendingNotification,
          notification_id: pendingNotification?.id,
          ticket_id: pendingNotification?.ticket_id,
          type: pendingNotification?.type
        },
        process_test: testResult
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro no teste:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});