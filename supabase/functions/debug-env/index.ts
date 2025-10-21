
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== DEBUG ENV VARS ===');
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const allEnvVars = Deno.env.toObject();
    
    console.log('OPENAI_API_KEY exists:', !!openAIApiKey);
    console.log('OPENAI_API_KEY length:', openAIApiKey ? openAIApiKey.length : 0);
    console.log('All env vars:', Object.keys(allEnvVars));
    console.log('Env vars count:', Object.keys(allEnvVars).length);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        openai_key_exists: !!openAIApiKey,
        openai_key_length: openAIApiKey ? openAIApiKey.length : 0,
        openai_key_preview: openAIApiKey ? openAIApiKey.substring(0, 10) + '...' : 'null',
        env_vars_count: Object.keys(allEnvVars).length,
        env_vars: Object.keys(allEnvVars),
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no debug:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});