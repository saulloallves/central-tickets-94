
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

    const { ticketId, texto, autor = 'franqueado', canal = 'typebot' } = await req.json();

    if (!ticketId || !texto) {
      return new Response(
        JSON.stringify({ error: 'ticketId e texto são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('💬 Adicionando mensagem ao ticket:', {
      ticketId,
      autor,
      canal,
      texto: texto.substring(0, 100) + (texto.length > 100 ? '...' : '')
    });

    // Verificar se o ticket existe
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, codigo_ticket, status')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('❌ Ticket não encontrado:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar a função RPC para adicionar a mensagem
    const { data: conversaAtualizada, error } = await supabase
      .rpc('append_to_ticket_conversa', {
        p_ticket_id: ticketId,
        p_autor: autor,
        p_texto: texto,
        p_canal: canal
      });

    if (error) {
      console.error('❌ Erro ao adicionar mensagem:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao adicionar mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Mensagem adicionada com sucesso:', {
      ticketId,
      codigo_ticket: ticket.codigo_ticket,
      totalMensagens: Array.isArray(conversaAtualizada) ? conversaAtualizada.length : 0
    });

    return new Response(
      JSON.stringify({
        success: true,
        ticketId,
        codigo_ticket: ticket.codigo_ticket,
        conversa: conversaAtualizada || [],
        message: 'Mensagem adicionada com sucesso'
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
