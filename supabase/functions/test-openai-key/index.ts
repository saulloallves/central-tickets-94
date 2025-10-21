
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    console.log('=== TESTE OPENAI KEY ===');
    console.log('OpenAI Key exists:', !!openAIApiKey);
    console.log('OpenAI Key length:', openAIApiKey ? openAIApiKey.length : 0);
    console.log('OpenAI Key first 10 chars:', openAIApiKey ? openAIApiKey.substring(0, 10) : 'null');

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'OPENAI_API_KEY não encontrada',
          exists: false 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test a simple API call
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
    });

    console.log('OpenAI API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'API Key inválida',
          details: errorText,
          status: response.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OpenAI API Key funcionando corretamente',
        keyExists: true,
        keyLength: openAIApiKey.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no teste:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});