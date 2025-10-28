import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from '../_shared/zapi-config.ts';

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

    console.log('📬 Processando lembretes de reunião pendentes...');

    // Buscar notificações pendentes de lembretes de reunião
    const { data: notifications, error: notifError } = await supabase
      .from('notifications_queue')
      .select('*')
      .eq('status', 'pending')
      .in('type', ['reuniao_lembrete_1_dia', 'reuniao_lembrete_1_hora', 'reuniao_lembrete_15_minutos'])
      .limit(10);

    if (notifError) {
      console.error('❌ Erro ao buscar notificações:', notifError);
      throw notifError;
    }

    console.log(`📋 Encontradas ${notifications?.length || 0} notificações para processar`);

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: 'Nenhuma notificação pendente'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Carregar configuração Z-API
    const zapiConfig = await loadZAPIConfig();

    if (!zapiConfig.instanceId || !zapiConfig.clientToken) {
      console.error('❌ Configuração Z-API incompleta');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuração Z-API incompleta'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let processed = 0;
    let errors = [];

    for (const notification of notifications) {
      try {
        console.log(`📤 Processando notificação ${notification.id} - Tipo: ${notification.type}`);

        // Marcar como processando
        await supabase
          .from('notifications_queue')
          .update({ status: 'processing' })
          .eq('id', notification.id);

        // Buscar template de mensagem
        const { data: template, error: templateError } = await supabase
          .from('message_templates')
          .select('template_content')
          .eq('template_key', notification.type)
          .eq('is_active', true)
          .maybeSingle();

        if (templateError || !template) {
          throw new Error(`Template não encontrado para ${notification.type}`);
        }

        // Preparar variáveis para o template
        const payload = notification.payload || {};
        const dataReuniao = new Date(payload.data_reuniao);
        const dataReuniaoBR = dataReuniao.toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'America/Sao_Paulo'
        });

        // Substituir variáveis no template
        let message = template.template_content
          .replace(/{{unidade_nome}}/g, payload.unidade_nome || 'Unidade')
          .replace(/{{responsavel_nome}}/g, payload.responsavel_nome || 'Responsável')
          .replace(/{{data_reuniao}}/g, dataReuniaoBR);

        console.log(`📝 Mensagem preparada (${message.length} caracteres)`);

        // Obter destino do payload
        const destination = payload.destination;

        if (!destination) {
          throw new Error('Destino não encontrado no payload');
        }

        console.log(`📱 Enviando para: ${destination}`);

        // Enviar via Z-API
        const zapiUrl = `${zapiConfig.baseUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.clientToken}/send-text`;
        
        const zapiResponse = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: destination,
            message: message
          })
        });

        const zapiResult = await zapiResponse.json();

        if (!zapiResponse.ok) {
          throw new Error(`Z-API error: ${JSON.stringify(zapiResult)}`);
        }

        console.log(`✅ Mensagem enviada via Z-API`);

        // Marcar como enviado
        await supabase
          .from('notifications_queue')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: {
              zapi_response: zapiResult,
              sent_to: destination
            }
          })
          .eq('id', notification.id);

        // Log de notificação
        await supabase
          .from('notification_logs')
          .insert({
            notification_id: notification.id,
            acompanhamento_id: notification.acompanhamento_id,
            type: notification.type,
            status: 'sent',
            destination: destination,
            message_preview: message.substring(0, 100),
            metadata: {
              zapi_response: zapiResult,
              data_reuniao: payload.data_reuniao,
              responsavel: payload.responsavel_nome
            }
          });

        processed++;

      } catch (error) {
        console.error(`❌ Erro ao processar notificação ${notification.id}:`, error);
        
        // Reverter para pending
        await supabase
          .from('notifications_queue')
          .update({ 
            status: 'pending',
            metadata: {
              last_error: error.message,
              last_attempt: new Date().toISOString()
            }
          })
          .eq('id', notification.id);

        errors.push({
          notification_id: notification.id,
          error: error.message
        });
      }
    }

    console.log(`✅ Processamento concluído. ${processed} notificações processadas`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        total: notifications.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Erro ao processar lembretes:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
