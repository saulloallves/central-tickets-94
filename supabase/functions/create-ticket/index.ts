import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const ticketData = await req.json();
    console.log('🎫 Creating ticket with data:', ticketData);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role for admin operations, but pass user auth for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { 
        headers: { 
          Authorization: req.headers.get('Authorization') ?? ''
        } 
      },
    });

    // Validate required fields
    if (!ticketData.unidade_id || !ticketData.descricao_problema) {
      return new Response(JSON.stringify({ 
        error: 'unidade_id e descricao_problema são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get auth user from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token de autenticação necessário' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract user ID from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile to establish relationships
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    let colaborador_id = null;
    if (profile?.email) {
      const { data: colaborador } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('email', profile.email)
        .single();
      
      if (colaborador) {
        colaborador_id = colaborador.id;
      }
    }

    // Validate and normalize priority
    const validPriorities = ['imediato', 'ate_1_hora', 'ainda_hoje', 'posso_esperar'];
    let finalPriority = ticketData.prioridade || 'posso_esperar';
    
    if (!validPriorities.includes(finalPriority)) {
      console.warn(`Invalid priority "${finalPriority}", using default`);
      finalPriority = 'posso_esperar';
    }

    // Prepare ticket data
    const ticketInsertData = {
      unidade_id: ticketData.unidade_id,
      descricao_problema: ticketData.descricao_problema,
      titulo: ticketData.titulo || null,
      canal_origem: ticketData.canal_origem || 'web',
      categoria: ticketData.categoria || null,
      subcategoria: ticketData.subcategoria || null,
      prioridade: finalPriority,
      status: 'aberto',
      criado_por: user.id,
      colaborador_id,
      equipe_responsavel_id: ticketData.equipe_responsavel_id || null,
      arquivos: ticketData.arquivos || [],
      log_ia: {},
      conversa: [],
      reaberto_count: 0,
      status_sla: 'dentro_prazo'
    };

    console.log('📝 Final ticket data for insert:', ticketInsertData);

    // Insert ticket
    const { data: newTicket, error: insertError } = await supabase
      .from('tickets')
      .insert(ticketInsertData)
      .select(`
        *,
        equipes!equipe_responsavel_id(nome),
        unidades(id, grupo, cidade, uf),
        colaboradores(nome_completo)
      `)
      .single();

    if (insertError) {
      console.error('❌ Failed to insert ticket:', insertError);
      return new Response(JSON.stringify({ 
        error: insertError.message,
        details: insertError.details || 'Erro ao criar ticket'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Ticket created successfully:', newTicket.codigo_ticket);

    return new Response(JSON.stringify({ 
      success: true,
      ticket: newTicket,
      message: `Ticket ${newTicket.codigo_ticket} criado com sucesso`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});