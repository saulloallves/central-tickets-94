import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cliente Supabase para buscar configurações
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
)

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 TESTE: Verificando configuração do bot...');
    
    // Buscar configuração do banco
    const { data: config, error } = await supabase
      .from('messaging_providers')
      .select('*')
      .eq('provider_name', 'zapi_bot')
      .eq('is_active', true)
      .single();

    console.log('🧪 TESTE: Resultado da busca:', { config, error });

    if (error) {
      console.error('❌ TESTE: Erro ao buscar configuração:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Erro ao buscar configuração',
        details: error 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500
      });
    }

    if (!config) {
      console.log('⚠️ TESTE: Configuração não encontrada');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Configuração do bot não encontrada' 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404
      });
    }

    console.log('✅ TESTE: Configuração encontrada:', {
      instance_id: config.instance_id?.substring(0, 8) + '...',
      is_active: config.is_active,
      updated_at: config.updated_at
    });

    // Teste de chamada do bot_base_1
    const testPayload = {
      isGroup: true,
      phone: "120363420372480204-group",
      text: {
        message: "menu"
      }
    };

    console.log('🧪 TESTE: Chamando bot_base_1 com payload:', testPayload);

    const functionsBaseUrl = Deno.env.get("FUNCTIONS_BASE_URL") || 
      `https://hryurntaljdisohawpqf.supabase.co/functions/v1`;

    const botResponse = await fetch(`${functionsBaseUrl}/bot_base_1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify(testPayload)
    });

    const botResponseText = await botResponse.text();
    console.log('🧪 TESTE: Resposta do bot_base_1:', {
      status: botResponse.status,
      response: botResponseText.substring(0, 500)
    });

    return new Response(JSON.stringify({
      success: true,
      config_found: true,
      config: {
        instance_id: config.instance_id?.substring(0, 8) + '...',
        is_active: config.is_active,
        updated_at: config.updated_at
      },
      bot_test: {
        status: botResponse.status,
        response: botResponseText
      }
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200
    });

  } catch (error) {
    console.error('❌ TESTE: Erro geral:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Erro interno no teste',
      details: error.message 
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500
    });
  }
});