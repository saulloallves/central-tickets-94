
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 === TESTANDO CREDENCIAIS ZAPI ===');
    
    // Buscar credenciais do ambiente
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID") || Deno.env.get("BOT_ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_TOKEN") || Deno.env.get("BOT_ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("BOT_ZAPI_CLIENT_TOKEN");
    const baseUrl = Deno.env.get("ZAPI_BASE_URL") || Deno.env.get("BOT_ZAPI_BASE_URL") || "https://api.z-api.io";

    console.log('📋 Credenciais encontradas:', {
      instanceId: instanceId ? instanceId.substring(0, 10) + '...' : 'não encontrado',
      instanceToken: instanceToken ? instanceToken.substring(0, 10) + '...' : 'não encontrado',
      clientToken: clientToken ? clientToken.substring(0, 10) + '...' : 'não encontrado',
      baseUrl
    });

    if (!instanceId || !instanceToken || !clientToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Credenciais ZAPI incompletas',
          missing: {
            instanceId: !instanceId,
            instanceToken: !instanceToken,
            clientToken: !clientToken
          }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Testar conexão com Z-API
    const testUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/status`;
    console.log('🔗 Testando endpoint:', testUrl.replace(instanceToken, '****'));

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken
      }
    });

    const responseData = await response.json();
    console.log('📊 Resposta da Z-API:', {
      status: response.status,
      data: responseData
    });

    if (response.status === 403) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token inválido ou não autorizado',
          status: response.status,
          details: responseData,
          message: 'O Client-Token não está autorizado. Verifique suas credenciais no painel Z-API.'
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao conectar com Z-API',
          status: response.status,
          details: responseData
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Credenciais ZAPI válidas',
        status: response.status,
        instanceStatus: responseData
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Erro ao testar credenciais:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});