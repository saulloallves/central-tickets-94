import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🔍 DEBUG WEBHOOK FLOW - Verificando configuração completa");

  try {
    // 1. Verificar configuração zapi_bot
    const { data: config, error } = await supabase
      .from('messaging_providers')
      .select('*')
      .eq('provider_name', 'zapi_bot')
      .eq('is_active', true)
      .single();

    console.log("📋 Configuração zapi_bot:", config);

    // 2. Simular payload do Z-API para "abacate"
    const testPayload = {
      phone: "120363420372480204-group",
      fromMe: false,
      isGroup: true,
      text: {
        message: "abacate"
      },
      buttonId: null,
      messageId: "test-debug-" + Date.now(),
      timestamp: Date.now()
    };

    console.log("📤 Simulando webhook do Z-API:", testPayload);

    // 3. Testar se zapi-whatsapp detecta e encaminha para bot_base_1
    const functionsBaseUrl = `https://${Deno.env.get('SUPABASE_URL')?.split('//')[1]}/functions/v1` || 'https://hryurntaljdisohawpqf.supabase.co/functions/v1';
    
    console.log("🔄 Testando zapi-whatsapp...");
    const zapiResponse = await fetch(`${functionsBaseUrl}/zapi-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(testPayload)
    });

    const zapiResponseText = await zapiResponse.text();
    console.log("📥 Resposta zapi-whatsapp:", zapiResponse.status, zapiResponseText);

    // 4. Testar bot_base_1 diretamente
    console.log("🔄 Testando bot_base_1 diretamente...");
    const botResponse = await fetch(`${functionsBaseUrl}/bot_base_1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(testPayload)
    });

    const botResponseText = await botResponse.text();
    console.log("📥 Resposta bot_base_1:", botResponse.status, botResponseText);

    // 5. Verificar se a instância está correta
    const instanceInfo = {
      configured_instance: config?.instance_id?.substring(0, 8) + '...',
      base_url: config?.base_url,
      is_active: config?.is_active
    };

    return new Response(JSON.stringify({
      debug_status: "completed",
      config_check: config ? "✅ Configurado" : "❌ Não configurado",
      instance_info: instanceInfo,
      zapi_whatsapp: {
        status: zapiResponse.status,
        response: zapiResponseText
      },
      bot_base_1: {
        status: botResponse.status,
        response: botResponseText
      },
      test_payload: testPayload
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ Erro no debug:", error);
    return new Response(JSON.stringify({
      error: "Debug failed",
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});