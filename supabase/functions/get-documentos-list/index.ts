
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
    const { status_filter, tipo_filter, categoria_filter, search_term, estilo_filter, page = 1, limit = 20 } = await req.json();
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    let query = supabase
      .from('documentos')
      .select(`
        id,
        artigo_id,
        titulo,
        categoria,
        versao,
        tipo,
        valido_ate,
        tags,
        status,
        justificativa,
        criado_por,
        criado_em,
        estilo,
        processado_por_ia,
        ia_modelo,
        profile:profiles!criado_por(nome_completo, email)
      `, { count: 'exact' })
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

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Calculate pagination metadata
    const totalPages = Math.ceil((count || 0) / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return new Response(
      JSON.stringify({
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext,
          hasPrev
        }
      }),
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
