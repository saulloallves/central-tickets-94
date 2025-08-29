import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id, status } = await req.json();
    
    if (!id || !status) {
      return new Response(
        JSON.stringify({ error: 'ID e status são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Atualizando documento:', id, 'para status:', status);

    const { data, error } = await supabase
      .from('documentos')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar documento:', error);
      throw error;
    }

    console.log('Documento atualizado com sucesso:', data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        document: data,
        message: `Status atualizado para ${status}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função kb-update-document:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});