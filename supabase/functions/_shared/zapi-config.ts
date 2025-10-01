import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Helper function to load Z-API configuration
export async function loadZAPIConfig() {
  console.log('🔧 Carregando configuração Z-API...');
  
  // Primeiro, tenta buscar da configuração do banco de dados
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: config, error } = await supabase
      .from('messaging_providers')
      .select('instance_id, instance_token, client_token, base_url')
      .eq('provider_name', 'zapi_bot')
      .eq('is_active', true)
      .maybeSingle();

    if (!error && config && config.instance_id) {
      console.log('✅ Configuração Z-API encontrada no banco:', config.instance_id?.substring(0, 8) + '...');
      return {
        instanceId: config.instance_id,
        instanceToken: config.instance_token,
        clientToken: config.client_token,
        baseUrl: config.base_url || 'https://api.z-api.io'
      };
    } else {
      console.log('⚠️ Configuração não encontrada no banco, usando env vars:', error?.message || 'Config não encontrada');
    }
  } catch (error) {
    console.error('❌ Erro ao buscar configuração no banco:', error);
  }

  // Fallback para variáveis de ambiente
  const config = {
    instanceId: Deno.env.get("BOT_ZAPI_INSTANCE_ID") || Deno.env.get("ZAPI_INSTANCE_ID"),
    instanceToken: Deno.env.get("BOT_ZAPI_TOKEN") || Deno.env.get("ZAPI_TOKEN"),
    clientToken: Deno.env.get("BOT_ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("BOT_ZAPI_TOKEN") || Deno.env.get("ZAPI_TOKEN"),
    baseUrl: Deno.env.get("BOT_ZAPI_BASE_URL") || Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io"
  };
  
  console.log('📝 Usando configuração das env vars:', config.instanceId?.substring(0, 8) + '...');
  
  return config;
}