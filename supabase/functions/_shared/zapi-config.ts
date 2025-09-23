// Helper function to load Z-API configuration
export async function loadZAPIConfig() {
  console.log('🔧 Carregando configuração Z-API dos secrets...');
  
  // Use bot-specific secrets first, fallback to general ones
  const config = {
    instanceId: Deno.env.get("BOT_ZAPI_INSTANCE_ID") || Deno.env.get("ZAPI_INSTANCE_ID"),
    instanceToken: Deno.env.get("BOT_ZAPI_TOKEN") || Deno.env.get("ZAPI_TOKEN"),
    clientToken: Deno.env.get("BOT_ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("BOT_ZAPI_TOKEN") || Deno.env.get("ZAPI_TOKEN"),
    baseUrl: Deno.env.get("BOT_ZAPI_BASE_URL") || Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io"
  };
  
  if (config.instanceId && config.instanceToken && config.clientToken) {
    console.log('✅ Configuração bot Z-API encontrada nos secrets:', config.instanceId?.substring(0, 8) + '...');
  } else {
    console.log('⚠️ Configuração bot Z-API incompleta nos secrets:', {
      instanceId: !!config.instanceId,
      instanceToken: !!config.instanceToken,
      clientToken: !!config.clientToken
    });
  }
  
  return config;
}