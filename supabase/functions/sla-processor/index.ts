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

    // ✅ Log detalhado de tickets vencidos para debug
    const { data: vencidosDebug, error: debugError } = await supabaseClient
      .from('tickets')
      .select('codigo_ticket, sla_minutos_restantes, sla_pausado, sla_pausado_horario, status_sla, tempo_pausado_total')
      .eq('status_sla', 'vencido')
      .neq('status', 'concluido')
      .limit(10);
    
    if (vencidosDebug && vencidosDebug.length > 0) {
      console.log('📊 Debug - Tickets vencidos ativos:');
      vencidosDebug.forEach(t => {
        console.log(`  • ${t.codigo_ticket}: ${t.sla_minutos_restantes}min | Pausado: ${t.sla_pausado} | Horário: ${t.sla_pausado_horario} | Tempo pausado: ${t.tempo_pausado_total}`);
      });
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

    console.log(`\n📊 ===== NOTIFICAÇÕES SELECIONADAS =====`);
    console.log(`📊 Total encontrado: ${pendingNotifications?.length || 0}`);
    
    if (pendingNotifications && pendingNotifications.length > 0) {
      console.log(`📋 IDs das notificações:`, pendingNotifications.map(n => n.id));
      console.log(`🎫 Tickets associados:`, pendingNotifications.map(n => n.ticket_id));
      
      // ✅ Verificar duplicatas
      const ticketIds = pendingNotifications.map(n => n.ticket_id);
      const uniqueTickets = new Set(ticketIds);
      if (ticketIds.length !== uniqueTickets.size) {
        console.warn(`⚠️ ATENÇÃO: Detectadas notificações duplicadas para o mesmo ticket!`);
        console.warn(`⚠️ Total: ${ticketIds.length}, Únicos: ${uniqueTickets.size}`);
        const duplicates = ticketIds.filter((id, index) => ticketIds.indexOf(id) !== index);
        console.warn(`⚠️ Tickets duplicados:`, duplicates);
      }
    }

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
        console.log(`\n📤 ===== PROCESSANDO NOTIFICAÇÃO ${notification.id} =====`);
        console.log(`📤 Tipo: ${notification.type}`);
        console.log(`🎫 Ticket: ${notification.ticket_id}`);
        console.log(`📅 Criada em: ${notification.created_at}`);
        console.log(`🔢 Tentativas: ${notification.attempts || 0}`);

        // Chamar a função process-notifications passando o notification como payload
        console.log(`🚀 Invocando process-notifications...`);
        const invokeStart = Date.now();
        
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
        
        const invokeDuration = Date.now() - invokeStart;
        console.log(`⏱️ Invocação completada em ${invokeDuration}ms`);

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