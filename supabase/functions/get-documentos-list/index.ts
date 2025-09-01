
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
    const { status_filter, tipo_filter, categoria_filter, search_term, estilo_filter } = await req.json();
    
    let query = supabase
      .from('documentos')
      .select(`
        *,
        profile:profiles!criado_por(nome_completo, email)
      `)
      .order('criado_em', { ascending: false });

    if (status_filter) {
      query = query.eq('status', status_filter);
    }
    if (tipo_filter) {
      query = query.eq('tipo', tipo_filter);
    }
    if (categoria_filter) {
      query = query.eq('categoria', categoria_filter);
    }
    if (estilo_filter) {
      query = query.eq('estilo', estilo_filter);
    }
    if (search_term) {
      query = query.ilike('titulo', `%${search_term}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify(data || []),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-documentos-list:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
