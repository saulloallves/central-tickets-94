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

    // 0. ✅ Decrementar SLAs de tickets ativos (conta o tempo passado)
    console.log('⏱️ Decrementando SLAs de tickets ativos...');
    const { data: decrementResult, error: decrementError } = await supabaseClient
      .rpc('decrementar_sla_minutos');

    if (decrementError) {
      console.error('❌ Erro ao decrementar SLAs:', decrementError);
    } else {
      console.log(`✅ SLAs decrementados: ${decrementResult?.tickets_atualizados || 0} tickets atualizados, ${decrementResult?.tickets_vencidos || 0} vencidos`);
    }

    // 1. Processar SLAs vencidos
    const { data: overdueResult, error: overdueError } = await supabaseClient
      .rpc('process_overdue_slas');

    if (overdueError) {
      console.error('❌ Erro ao processar SLAs vencidos:', overdueError);
      throw overdueError;
    }

    console.log(`✅ SLAs vencidos processados: ${overdueResult} tickets`);

    // 2. Processar notificações não enviadas ao WhatsApp (apenas PENDING)
    console.log('📤 Buscando notificações PENDING não enviadas ao WhatsApp...');
    
    // ✅ SELECT primeiro com ORDER, depois UPDATE em lote
    const { data: pendingNotifications, error: notificationError } = await supabaseClient
      .from('notifications_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('sent_to_whatsapp', false)
      .eq('type', 'sla_breach')
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })  // ✅ ORDER adicionado para evitar PGRST109
      .limit(20);

    console.log(`📊 Encontradas ${pendingNotifications?.length || 0} notificações para processar`);

    if (notificationError) {
      console.error('❌ Erro ao buscar notificações pendentes:', notificationError);
      throw notificationError;
    }

    // ✅ Marcar como 'processing' em lote DEPOIS de buscar
    if (pendingNotifications && pendingNotifications.length > 0) {
      const notificationIds = pendingNotifications.map(n => n.id);
      
      const { error: updateError } = await supabaseClient
        .from('notifications_queue')
        .update({ status: 'processing' })
        .in('id', notificationIds);
      
      if (updateError) {
        console.error('❌ Erro ao marcar notificações como processing:', updateError);
      } else {
        console.log(`✅ ${notificationIds.length} notificações marcadas como processing`);
      }
      
      console.log(`📤 Detalhes:`, pendingNotifications.map(n => ({ 
        id: n.id, 
        ticket_id: n.ticket_id, 
        type: n.type,
        created_at: n.created_at
      })));
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