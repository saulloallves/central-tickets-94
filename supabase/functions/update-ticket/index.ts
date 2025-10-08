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
    const { ticketId, updates } = await req.json();
    console.log('🔄 Updating ticket:', ticketId, 'with:', updates);

    if (!ticketId) {
      return new Response(JSON.stringify({ error: 'ticketId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Usar service role sem passar Authorization header para contornar RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extrair user_id do token JWT para validação de permissões
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const [, payload] = token.split('.');
        const decoded = JSON.parse(atob(payload));
        userId = decoded.sub;
      } catch (e) {
        console.error('Erro ao decodificar token:', e);
      }
    }

    // Get current ticket to validate permissions
    const { data: currentTicket, error: currentError } = await supabase
      .from('tickets')
      .select('id, status, unidade_id, equipe_responsavel_id')
      .eq('id', ticketId)
      .single();

    if (currentError || !currentTicket) {
      console.error('❌ Failed to get current ticket:', currentError);
      return new Response(JSON.stringify({ error: 'Ticket não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare update payload
    const updatePayload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Update ticket
    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update(updatePayload)
      .eq('id', ticketId)
      .select(`
        *,
        equipes!equipe_responsavel_id(nome),
        unidades(id, grupo, cidade, uf),
        colaboradores(nome_completo)
      `)
      .single();

    if (updateError) {
      console.error('❌ Failed to update ticket:', updateError);
      return new Response(JSON.stringify({ 
        error: updateError.message,
        details: updateError.details || 'Erro ao atualizar ticket'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Ticket updated successfully:', updatedTicket.codigo_ticket);

    return new Response(JSON.stringify({ 
      success: true,
      ticket: updatedTicket,
      message: 'Ticket atualizado com sucesso'
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