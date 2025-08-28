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
    const { ticketId } = await req.json();
    console.log('🗑️ Deleting ticket:', ticketId);

    if (!ticketId) {
      return new Response(JSON.stringify({ error: 'ticketId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Get current ticket to validate permissions and for logging
    const { data: currentTicket, error: currentError } = await supabase
      .from('tickets')
      .select('id, codigo_ticket, unidade_id, equipe_responsavel_id')
      .eq('id', ticketId)
      .single();

    if (currentError || !currentTicket) {
      console.error('❌ Failed to get current ticket:', currentError);
      return new Response(JSON.stringify({ error: 'Ticket não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete ticket
    const { error: deleteError } = await supabase
      .from('tickets')
      .delete()
      .eq('id', ticketId);

    if (deleteError) {
      console.error('❌ Failed to delete ticket:', deleteError);
      return new Response(JSON.stringify({ 
        error: deleteError.message,
        details: deleteError.details || 'Erro ao deletar ticket'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Ticket deleted successfully:', currentTicket.codigo_ticket);

    return new Response(JSON.stringify({ 
      success: true,
      ticketId,
      message: `Ticket ${currentTicket.codigo_ticket} deletado com sucesso`
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