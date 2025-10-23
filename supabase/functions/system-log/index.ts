// Using native Deno.serve (no import needed)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      tipo_log,
      entidade_afetada,
      entidade_id,
      acao_realizada,
      usuario_responsavel,
      ia_modelo,
      prompt_entrada,
      resposta_gerada,
      dados_anteriores,
      dados_novos,
      canal = 'web',
      origem_ip,
      navegador_agente
    } = await req.json();

    console.log('Logging system action:', {
      tipo_log,
      entidade_afetada,
      entidade_id,
      acao_realizada
    });

    // Call the log_system_action function
    const { data, error } = await supabase.rpc('log_system_action', {
      p_tipo_log: tipo_log,
      p_entidade_afetada: entidade_afetada,
      p_entidade_id: entidade_id,
      p_acao_realizada: acao_realizada,
      p_usuario_responsavel: usuario_responsavel,
      p_ia_modelo: ia_modelo,
      p_prompt_entrada: prompt_entrada,
      p_resposta_gerada: resposta_gerada,
      p_dados_anteriores: dados_anteriores,
      p_dados_novos: dados_novos,
      p_canal: canal,
      p_origem_ip: origem_ip,
      p_navegador_agente: navegador_agente
    });

    if (error) {
      console.error('Error logging system action:', error);
      throw error;
    }

    console.log('System action logged successfully:', data);

    return new Response(JSON.stringify({ 
      success: true, 
      log_id: data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in system-log function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});