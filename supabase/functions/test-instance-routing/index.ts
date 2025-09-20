import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getConfigurationsData() {
  // Testar configurações do zapi-whatsapp
  const zapiwWhatsappConfig = {
    instanceId: Deno.env.get('ZAPI_INSTANCE_ID'),
    token: Deno.env.get('ZAPI_TOKEN'),
    clientToken: Deno.env.get('ZAPI_CLIENT_TOKEN'),
    baseUrl: Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io'
  };

  // Testar configurações do bot_base_1
  const botConfig = {
    instanceId: Deno.env.get('BOT_ZAPI_INSTANCE_ID') || Deno.env.get('ZAPI_INSTANCE_ID'),
    token: Deno.env.get('BOT_ZAPI_TOKEN') || Deno.env.get('ZAPI_TOKEN'),
    clientToken: Deno.env.get('BOT_ZAPI_CLIENT_TOKEN') || Deno.env.get('ZAPI_CLIENT_TOKEN'),
    baseUrl: Deno.env.get('BOT_ZAPI_BASE_URL') || Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io'
  };

  // Testar configurações do send-ticket-notification
  const notificationConfig = {
    instanceId: Deno.env.get('NOTIFICATION_ZAPI_INSTANCE_ID') || Deno.env.get('ZAPI_INSTANCE_ID'),
    token: Deno.env.get('NOTIFICATION_ZAPI_TOKEN') || Deno.env.get('ZAPI_TOKEN'),
    clientToken: Deno.env.get('NOTIFICATION_ZAPI_CLIENT_TOKEN') || Deno.env.get('ZAPI_CLIENT_TOKEN'),
    baseUrl: Deno.env.get('NOTIFICATION_ZAPI_BASE_URL') || Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io'
  };

  const result = {
    timestamp: new Date().toISOString(),
    configurations: {
      zapi_whatsapp: {
        ...zapiwWhatsappConfig,
        configured: !!(zapiwWhatsappConfig.instanceId && zapiwWhatsappConfig.token && zapiwWhatsappConfig.clientToken),
        function: 'Receber mensagens do WhatsApp e processar conversas naturais'
      },
      bot_base_1: {
        ...botConfig,
        configured: !!(botConfig.instanceId && botConfig.token && botConfig.clientToken),
        function: 'Enviar botões e respostas do bot automatizado'
      },
      send_ticket_notification: {
        ...notificationConfig,
        configured: !!(notificationConfig.instanceId && notificationConfig.token && notificationConfig.clientToken),
        function: 'Enviar notificações automáticas de tickets'
      }
    },
    conflicts: {
      same_instance_whatsapp_bot: zapiwWhatsappConfig.instanceId === botConfig.instanceId,
      same_instance_whatsapp_notification: zapiwWhatsappConfig.instanceId === notificationConfig.instanceId,
      same_instance_bot_notification: botConfig.instanceId === notificationConfig.instanceId,
      all_same_instance: zapiwWhatsappConfig.instanceId === botConfig.instanceId && 
                        botConfig.instanceId === notificationConfig.instanceId
    },
    recommendations: []
  };

  // Adicionar recomendações baseadas nos conflitos
  if (result.conflicts.all_same_instance) {
    result.recommendations.push(
      'CRÍTICO: Todas as funções estão usando a mesma instância Z-API. Configure instâncias separadas.',
      'Configure BOT_ZAPI_INSTANCE_ID para bot_base_1',
      'Configure NOTIFICATION_ZAPI_INSTANCE_ID para send-ticket-notification'
    );
  } else if (result.conflicts.same_instance_whatsapp_bot) {
    result.recommendations.push(
      'ATENÇÃO: zapi-whatsapp e bot_base_1 usam a mesma instância. Configure BOT_ZAPI_INSTANCE_ID separada.'
    );
  } else if (result.conflicts.same_instance_whatsapp_notification) {
    result.recommendations.push(
      'ATENÇÃO: zapi-whatsapp e notifications usam a mesma instância. Configure NOTIFICATION_ZAPI_INSTANCE_ID separada.'
    );
  }

  if (result.recommendations.length === 0) {
    result.recommendations.push('✅ Configuração está adequada - cada função usa sua própria instância.');
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Se for uma requisição para buscar configurações
    if (body.action === 'get_configs') {
      const result = getConfigurationsData();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🧪 Testando configuração de instâncias Z-API');

    const result = getConfigurationsData();

    console.log('📊 Resultado do teste:', JSON.stringify(result, null, 2));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});