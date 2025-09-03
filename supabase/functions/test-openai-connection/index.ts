import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== DEBUG OPENAI KEY ===');
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    console.log('OPENAI_API_KEY exists:', !!openAIApiKey);
    console.log('OPENAI_API_KEY length:', openAIApiKey ? openAIApiKey.length : 0);
    console.log('OPENAI_API_KEY first 10 chars:', openAIApiKey ? openAIApiKey.substring(0, 10) : 'null');

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'OPENAI_API_KEY não encontrada',
          exists: false 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test a simple API call to verify the key
    console.log('Testing OpenAI API...');
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
          error: 'API Key inválida ou erro na OpenAI',
          details: errorText,
          status: response.status,
          key_exists: true,
          key_length: openAIApiKey.length
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const models = await response.json();
    console.log('OpenAI models retrieved:', models.data?.length || 0);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OpenAI API Key funcionando corretamente',
        keyExists: true,
        keyLength: openAIApiKey.length,
        modelsAvailable: models.data?.length || 0
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