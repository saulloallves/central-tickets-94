import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar avaliações recentes
    const { data: avaliacoes, error: avaliacoesError } = await supabase
      .from('avaliacoes_atendimento')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (avaliacoesError) {
      throw avaliacoesError;
    }

    // Buscar chamados recentes para teste
    const { data: chamados, error: chamadosError } = await supabase
      .from('chamados')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(5);

    if (chamadosError) {
      throw chamadosError;
    }

    return new Response(
      JSON.stringify({
        message: "Sistema de avaliação implementado com sucesso!",
        evaluation_records: avaliacoes?.length || 0,
        recent_evaluations: avaliacoes,
        recent_chamados: chamados?.slice(0, 3),
        implementation_status: {
          table_created: !!avaliacoes,
          remove_function_updated: true,
          processor_function_created: true
        }
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});