
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { ticketId } = await req.json();

    if (!ticketId) {
      return new Response(
        JSON.stringify({ error: 'ticketId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📖 Buscando conversa do ticket:', ticketId);

    // Usar a função RPC para buscar a conversa
    const { data: conversa, error } = await supabase
      .rpc('get_ticket_conversa', { p_ticket_id: ticketId });

    if (error) {
      console.error('❌ Erro ao buscar conversa:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar conversa do ticket' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados básicos do ticket para contexto
    const { data: ticket } = await supabase
      .from('tickets')
      .select('codigo_ticket, status, unidade_id')
      .eq('id', ticketId)
      .single();

    console.log('✅ Conversa encontrada:', {
      ticketId,
      codigo: ticket?.codigo_ticket,
      mensagens: Array.isArray(conversa) ? conversa.length : 0
    });

    return new Response(
      JSON.stringify({
        ticketId,
        codigo_ticket: ticket?.codigo_ticket || 'N/A',
        status: ticket?.status || 'unknown',
        unidade_id: ticket?.unidade_id || 'N/A',
        conversa: conversa || []
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
