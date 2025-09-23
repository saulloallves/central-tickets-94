import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cliente Supabase para buscar configurações
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
)

// Função para carregar configuração Z-API do banco
async function loadZAPIConfig() {
  console.log('🔧 Carregando configuração Z-API...');
  
  // Primeiro, tenta buscar da configuração do banco (Bot Automatizado)
  try {
    const { data: config, error } = await supabase
      .from('messaging_providers')
      .select('*')
      .eq('provider_name', 'zapi_bot')
      .eq('is_active', true)
      .single();

    if (!error && config) {
      console.log('✅ Configuração do bot encontrada no banco:', config.instance_id?.substring(0, 8) + '...');
      return {
        instanceId: config.instance_id,
        instanceToken: config.instance_token,
        clientToken: config.client_token,
        baseUrl: config.base_url || 'https://api.z-api.io'
      };
    } else {
      console.log('⚠️ Configuração do bot não encontrada, usando env vars');
    }
  } catch (error) {
    console.error('❌ Erro ao buscar configuração no banco:', error);
  }

  // Fallback para variáveis de ambiente
  const config = {
    instanceId: Deno.env.get("ZAPI_INSTANCE_ID"),
    instanceToken: Deno.env.get("ZAPI_TOKEN"),
    clientToken: Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN"),
    baseUrl: Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io"
  };
  
  console.log('📝 Usando configuração das env vars:', config.instanceId?.substring(0, 8) + '...');
  return config;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const phone = body?.body?.phone || body?.phone;
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    // Carrega configurações Z-API
    const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();

    if (!instanceId || !instanceToken || !clientToken) {
      return new Response(JSON.stringify({ 
        error: "Configuração Z-API incompleta", 
        details: "ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN são obrigatórios" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    // Monta o menu principal
    const payload = {
      phone,
      message: "👋 Oi! Eu sou o *GiraBot*, seu assistente automático da *Cresci e Perdi*.\n\nAs opções de atendimento mudaram. Como prefere seguir?",
      buttonList: {
        buttons: [
          { id: "autoatendimento_menu", label: "🟢 GiraBot - Autoatendimento" },
          { id: "personalizado_menu", label: "🔵 Atendimento Personalizado - Concierge" },
          { id: "suporte_dfcom", label: "⚫ Suporte Imediato - DFCom" },
          { id: "emergencia_menu", label: "🔴 Estou em uma Emergência" },
        ],
      },
    };

    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-button-list`;
    console.log(`📤 Enviando para Z-API: ${zapiUrl.replace(instanceToken, '****')}`);

    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("📤 Menu Principal enviado:", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: res.status,
    });
  } catch (err) {
    console.error("❌ Erro no menu_principal:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});