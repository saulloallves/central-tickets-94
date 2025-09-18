import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Iniciando diagnóstico de notificações...');

    // 1. Verificar configuração Z-API na base
    const { data: zapiConfig } = await supabase
      .from('messaging_providers')
      .select('*')
      .eq('provider_name', 'zapi')
      .eq('is_active', true)
      .single();

    console.log('📡 Config Z-API na base:', zapiConfig);

    // 2. Verificar variáveis de ambiente
    const envConfig = {
      ZAPI_INSTANCE_ID: Deno.env.get('ZAPI_INSTANCE_ID'),
      ZAPI_TOKEN: Deno.env.get('ZAPI_TOKEN'),
      ZAPI_CLIENT_TOKEN: Deno.env.get('ZAPI_CLIENT_TOKEN'),
      ZAPI_BASE_URL: Deno.env.get('ZAPI_BASE_URL')
    };

    console.log('🌍 Vars de ambiente:', {
      ZAPI_INSTANCE_ID: envConfig.ZAPI_INSTANCE_ID ? 'Definida' : 'Não definida',
      ZAPI_TOKEN: envConfig.ZAPI_TOKEN ? 'Definida' : 'Não definida',
      ZAPI_CLIENT_TOKEN: envConfig.ZAPI_CLIENT_TOKEN ? 'Definida' : 'Não definida',
      ZAPI_BASE_URL: envConfig.ZAPI_BASE_URL || 'Padrão'
    });

    // 3. Verificar configuração de notificação
    const { data: notificationConfig } = await supabase
      .from('notification_source_config')
      .select('*')
      .eq('notification_type', 'ticket_created')
      .eq('is_active', true);

    console.log('📥 Config de notificação:', notificationConfig);

    // 4. Verificar exemplo de unidade com grupo
    const { data: unidadeExemplo } = await supabase
      .from('unidades')
      .select('id, grupo, id_grupo_branco')
      .eq('id', 'a9af7dfc-c210-4a52-bb60-065c5dc1f40e')
      .single();

    console.log('🏢 Unidade de teste:', unidadeExemplo);

    // 5. Testar envio simples via Z-API
    let testResult = null;
    if (zapiConfig && unidadeExemplo?.id_grupo_branco) {
      try {
        const testMessage = `🧪 TESTE DEBUG - ${new Date().toLocaleString('pt-BR')}\n\nTeste de conectividade Z-API`;
        
        const response = await fetch(`${zapiConfig.base_url}/instances/${zapiConfig.instance_id}/token/${zapiConfig.instance_token}/send-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiConfig.client_token,
          },
          body: JSON.stringify({
            phone: unidadeExemplo.id_grupo_branco,
            message: testMessage,
          }),
        });

        const responseText = await response.text();
        testResult = {
          status: response.status,
          ok: response.ok,
          response: responseText,
          sent_to: unidadeExemplo.id_grupo_branco
        };

        console.log('🧪 Resultado do teste:', testResult);
      } catch (error) {
        testResult = {
          error: error.message,
          sent_to: unidadeExemplo.id_grupo_branco
        };
        console.error('❌ Erro no teste:', error);
      }
    }

    // 6. Verificar últimos logs de notificação
    const { data: recentLogs } = await supabase
      .from('escalation_logs')
      .select('*')
      .eq('event_type', 'notification_sent')
      .order('created_at', { ascending: false })
      .limit(3);

    console.log('📋 Logs recentes:', recentLogs);

    return new Response(JSON.stringify({
      success: true,
      diagnostico: {
        zapi_config_database: zapiConfig,
        environment_vars: {
          ZAPI_INSTANCE_ID: envConfig.ZAPI_INSTANCE_ID ? 'Configurada' : 'Não configurada',
          ZAPI_TOKEN: envConfig.ZAPI_TOKEN ? 'Configurada' : 'Não configurada',
          ZAPI_CLIENT_TOKEN: envConfig.ZAPI_CLIENT_TOKEN ? 'Configurada' : 'Não configurada',
          ZAPI_BASE_URL: envConfig.ZAPI_BASE_URL || 'Usando padrão'
        },
        notification_config: notificationConfig,
        test_unit: unidadeExemplo,
        test_result: testResult,
        recent_logs: recentLogs
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro no diagnóstico:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});