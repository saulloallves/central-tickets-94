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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🕐 Iniciando processamento de SLAs...');

    // 1. Processar SLAs vencidos
    const { data: overdueResult, error: overdueError } = await supabaseClient
      .rpc('process_overdue_slas');

    if (overdueError) {
      console.error('❌ Erro ao processar SLAs vencidos:', overdueError);
      throw overdueError;
    }

    console.log(`✅ SLAs vencidos processados: ${overdueResult} tickets`);

    // 2. Processar SLAs em 50%
    const { data: halfResult, error: halfError } = await supabaseClient
      .rpc('process_sla_half_warnings');

    if (halfError) {
      console.error('❌ Erro ao processar avisos de 50% SLA:', halfError);
      throw halfError;
    }

    console.log(`✅ Avisos de 50% SLA processados: ${halfResult} notificações`);

    // 3. Processar notificações pendentes
    const { data: pendingNotifications, error: notificationError } = await supabaseClient
      .from('notifications_queue')
      .select('*')
      .eq('status', 'pending')
      .in('type', ['sla_breach', 'sla_half'])
      .limit(10);

    if (notificationError) {
      console.error('❌ Erro ao buscar notificações pendentes:', notificationError);
      throw notificationError;
    }

    let notificationsProcessed = 0;

    // Processar cada notificação pendente
    for (const notification of pendingNotifications || []) {
      try {
        console.log(`📤 Processando notificação ${notification.type} para ticket ${notification.ticket_id}`);

        // Chamar a função process-notifications
        const { error: processError } = await supabaseClient.functions.invoke('process-notifications', {
          body: {
            ticketId: notification.ticket_id,
            type: notification.type,
            payload: notification.payload
          }
        });

        if (processError) {
          console.error(`❌ Erro ao processar notificação ${notification.id}:`, processError);
          
          // Marcar como falha se exceder tentativas
          await supabaseClient
            .from('notifications_queue')
            .update({ 
              status: 'failed',
              attempts: (notification.attempts || 0) + 1,
              processed_at: new Date().toISOString()
            })
            .eq('id', notification.id);
        } else {
          console.log(`✅ Notificação ${notification.id} processada com sucesso`);
          
          // Marcar como processada
          await supabaseClient
            .from('notifications_queue')
            .update({ 
              status: 'processed',
              processed_at: new Date().toISOString()
            })
            .eq('id', notification.id);
            
          notificationsProcessed++;
        }
      } catch (error) {
        console.error(`❌ Erro ao processar notificação ${notification.id}:`, error);
      }
    }

    const result = {
      success: true,
      slas_vencidos_processados: overdueResult || 0,
      avisos_50_criados: halfResult || 0,
      notificacoes_processadas: notificationsProcessed,
      timestamp: new Date().toISOString()
    };

    console.log('📊 Resultado do processamento:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Erro no processamento de SLAs:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
});