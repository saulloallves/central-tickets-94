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

    // 3. Processar notificações não enviadas ao WhatsApp (apenas PENDING)
    console.log('📤 Buscando notificações PENDING não enviadas ao WhatsApp...');
    
    // ✅ ATOMIC UPDATE: Pega e marca como 'processing' atomicamente para evitar duplicatas
    const { data: pendingNotifications, error: notificationError } = await supabaseClient
      .from('notifications_queue')
      .update({ status: 'processing' })
      .eq('status', 'pending')  // ✅ APENAS PENDING
      .eq('sent_to_whatsapp', false)
      .in('type', ['sla_breach', 'sla_half'])
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .limit(20)
      .select();
    
    console.log(`📊 Encontradas ${pendingNotifications?.length || 0} notificações para processar`);
    if (pendingNotifications && pendingNotifications.length > 0) {
      console.log(`📤 Detalhes:`, pendingNotifications.map(n => ({ 
        id: n.id, 
        ticket_id: n.ticket_id, 
        type: n.type,
        status: n.status,
        sent_to_whatsapp: n.sent_to_whatsapp,
        attempts: n.attempts 
      })));
    }

    if (notificationError) {
      console.error('❌ Erro ao buscar notificações pendentes:', notificationError);
      throw notificationError;
    }

    let notificationsProcessed = 0;

    // Processar cada notificação pendente
    for (const notification of pendingNotifications || []) {
      try {
        console.log(`📤 Processando notificação ${notification.type} para ticket ${notification.ticket_id}`);

        // Chamar a função process-notifications passando o notification como payload
        const { error: processError } = await supabaseClient.functions.invoke('process-notifications', {
          body: {
            type: notification.type,
            ticketId: notification.ticket_id,
            payload: {
              ...notification.payload,
              notificationId: notification.id
            }
          }
        });

        if (processError) {
          console.error(`❌ Erro ao processar notificação ${notification.id}:`, processError);
          
          // Voltar para pending em caso de erro
          await supabaseClient
            .from('notifications_queue')
            .update({ 
              status: 'pending',
              attempts: (notification.attempts || 0) + 1
            })
            .eq('id', notification.id);
        } else {
          console.log(`✅ Notificação ${notification.id} enviada ao WhatsApp com sucesso`);
          notificationsProcessed++;
        }
      } catch (error) {
        console.error(`❌ Erro ao processar notificação ${notification.id}:`, error);
        
        // Voltar para pending em caso de erro
        await supabaseClient
          .from('notifications_queue')
          .update({ 
            status: 'pending',
            attempts: (notification.attempts || 0) + 1
          })
          .eq('id', notification.id);
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