import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { api_key, api_base_url, custom_headers } = await req.json();

    if (!api_key || !api_base_url) {
      return new Response(
        JSON.stringify({ error: 'API key e base URL são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Testando conexão Lambda:', {
      url: `${api_base_url}/models`,
      has_api_key: !!api_key,
      custom_headers_count: Object.keys(custom_headers || {}).length
    });

    const headers: any = {
      'Content-Type': 'application/json',
      ...custom_headers,
    };
    
    if (api_key) {
      headers['Authorization'] = `Bearer ${api_key}`;
    }

    const response = await fetch(`${api_base_url}/models`, {
      method: 'GET',
      headers,
    });

    console.log('Resposta Lambda API:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Sem resposta do servidor');
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    console.log('Dados recebidos da Lambda API:', data);
    
    // Process models list (try different response formats)
    let models = [];
    if (data.data && Array.isArray(data.data)) {
      models = data.data;
    } else if (data.models && Array.isArray(data.models)) {
      models = data.models;
    } else if (Array.isArray(data)) {
      models = data;
    } else {
      throw new Error('Formato de resposta não reconhecido. Esperado: {data: []} ou {models: []} ou []');
    }

    const formattedModels = models.map((model: any) => ({
      value: model.id || model.model || model.name || String(model),
      label: model.id || model.model || model.name || String(model),
      description: model.description || model.desc || 'Modelo customizado da API Lambda'
    }));

    if (formattedModels.length === 0) {
      throw new Error('Nenhum modelo encontrado na resposta da API');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        models: formattedModels,
        count: formattedModels.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro ao testar conexão Lambda:', error);
    
    let errorMessage = 'Erro desconhecido';
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'Falha na conexão: Verifique se a URL está correta e se o servidor está acessível.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})