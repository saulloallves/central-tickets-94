import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookToken = Deno.env.get('TYPEBOT_WEBHOOK_TOKEN');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Typebot webhook called');
    
    // Verificar token se configurado
    if (webhookToken) {
      const authHeader = req.headers.get('authorization');
      const providedToken = authHeader?.replace('Bearer ', '') || req.headers.get('x-webhook-token');
      
      if (providedToken !== webhookToken) {
        console.log('Invalid webhook token');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await req.json();
    console.log('Received data from Typebot:', JSON.stringify(body, null, 2));

    // Extrair dados do payload do Typebot
    const {
      nome_cliente,
      email_cliente,
      telefone_cliente,
      descricao_problema,
      categoria,
      prioridade = 'padrao_24h',
      unidade_id = 'default',
      canal_origem = 'typebot'
    } = body;

    // Validar dados obrigatórios
    if (!descricao_problema) {
      return new Response(JSON.stringify({ 
        error: 'Descrição do problema é obrigatória',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Criar ticket no sistema
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        unidade_id,
        descricao_problema,
        categoria: categoria || 'geral',
        prioridade,
        canal_origem,
        status: 'aberto',
        data_abertura: new Date().toISOString(),
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      return new Response(JSON.stringify({ 
        error: 'Erro ao criar ticket',
        details: ticketError.message,
        success: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se tiver informações do cliente, adicionar como primeira mensagem
    let clientInfo = '';
    if (nome_cliente || email_cliente || telefone_cliente) {
      const info = [];
      if (nome_cliente) info.push(`Nome: ${nome_cliente}`);
      if (email_cliente) info.push(`Email: ${email_cliente}`);
      if (telefone_cliente) info.push(`Telefone: ${telefone_cliente}`);
      clientInfo = info.join('\n');

      // Adicionar mensagem com dados do cliente
      await supabase
        .from('ticket_mensagens')
        .insert({
          ticket_id: ticket.id,
          mensagem: `Dados do cliente:\n${clientInfo}`,
          direcao: 'entrada',
          canal: 'web'
        });
    }

    console.log('Ticket created successfully:', ticket.codigo_ticket);

    // Resposta de sucesso para o Typebot
    return new Response(JSON.stringify({
      success: true,
      ticket_id: ticket.id,
      codigo_ticket: ticket.codigo_ticket,
      message: `Ticket ${ticket.codigo_ticket} criado com sucesso!`,
      data: {
        ticket_id: ticket.id,
        codigo: ticket.codigo_ticket,
        status: ticket.status,
        prioridade: ticket.prioridade
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in typebot webhook:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro interno do servidor',
      details: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});