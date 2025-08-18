import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookToken = Deno.env.get('TYPEBOT_WEBHOOK_TOKEN');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Função para extrair termos de busca do texto
function extractSearchTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 3)
    .slice(0, 10);
}

// Módulo de resposta por Knowledge Base
async function searchKnowledgeBase(message: string) {
  console.log('Searching knowledge base for:', message);
  
  const searchTerms = extractSearchTerms(message);
  console.log('Search terms:', searchTerms);

  if (searchTerms.length === 0) {
    return { hasAnswer: false, articles: [] };
  }

  // Buscar artigos relevantes na base de conhecimento
  const { data: articles, error } = await supabase
    .from('knowledge_articles')
    .select('id, titulo, conteudo, categoria, tags')
    .eq('ativo', true)
    .eq('aprovado', true)
    .eq('usado_pela_ia', true);

  if (error) {
    console.error('Error fetching KB articles:', error);
    return { hasAnswer: false, articles: [] };
  }

  // Filtrar artigos que contenham os termos de busca
  const relevantArticles = articles?.filter(article => {
    const searchText = `${article.titulo} ${article.conteudo} ${article.categoria} ${article.tags?.join(' ') || ''}`.toLowerCase();
    return searchTerms.some(term => searchText.includes(term));
  }) || [];

  console.log(`Found ${relevantArticles.length} relevant articles`);

  // Se temos artigos relevantes, tentar gerar resposta com OpenAI
  if (relevantArticles.length > 0 && openaiApiKey) {
    const knowledgeContext = relevantArticles
      .map(article => `**${article.titulo}**\n${article.conteudo}`)
      .join('\n\n---\n\n');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Você é um assistente de suporte técnico. Use APENAS as informações fornecidas na base de conhecimento para responder. Se a informação não estiver disponível na base de conhecimento, responda "Não encontrei informações suficientes na base de conhecimento para responder essa pergunta."

Base de Conhecimento:
${knowledgeContext}`
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      const aiResponse = await response.json();
      const answer = aiResponse.choices?.[0]?.message?.content;

      if (answer && !answer.includes('Não encontrei informações suficientes')) {
        return {
          hasAnswer: true,
          answer,
          sources: relevantArticles.map(a => ({ id: a.id, titulo: a.titulo }))
        };
      }
    } catch (error) {
      console.error('Error calling OpenAI:', error);
    }
  }

  return { hasAnswer: false, articles: relevantArticles };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Typebot webhook called');
    
    // Validar token via header X-Webhook-Token
    if (webhookToken) {
      const providedToken = req.headers.get('x-webhook-token');
      
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

    const {
      message,
      unidade_id = 'default',
      user,
      attachments,
      category_hint,
      force_create = false,
      metadata
    } = body;

    // Validar dados obrigatórios
    if (!message) {
      return new Response(JSON.stringify({ 
        error: 'Campo "message" é obrigatório',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Primeiro, tentar responder pela base de conhecimento (se não forçar criação)
    if (!force_create) {
      const kbResult = await searchKnowledgeBase(message);
      
      if (kbResult.hasAnswer) {
        console.log('Answer found in knowledge base');
        return new Response(JSON.stringify({
          action: 'answer',
          success: true,
          answer: kbResult.answer,
          sources: kbResult.sources,
          message: 'Resposta encontrada na base de conhecimento'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Se não encontrou resposta na KB ou forçou criação, criar ticket
    console.log('Creating ticket - no suitable KB answer found');

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        unidade_id,
        descricao_problema: message,
        categoria: category_hint || 'geral',
        prioridade: 'padrao_24h',
        canal_origem: 'typebot',
        status: 'aberto',
        data_abertura: new Date().toISOString(),
        arquivos: attachments || [],
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

    // Inserir primeira mensagem do usuário
    await supabase
      .from('ticket_mensagens')
      .insert({
        ticket_id: ticket.id,
        mensagem: message,
        direcao: 'entrada',
        canal: 'typebot',
        anexos: attachments || []
      });

    // Se tiver dados do usuário, adicionar como contexto
    if (user) {
      const userInfo = Object.entries(user)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      await supabase
        .from('ticket_mensagens')
        .insert({
          ticket_id: ticket.id,
          mensagem: `Dados do usuário:\n${userInfo}`,
          direcao: 'entrada',
          canal: 'typebot'
        });
    }

    // Invocar análise automática do ticket
    try {
      const { data: analysisResult, error: analysisError } = await supabase.functions.invoke('analyze-ticket', {
        body: {
          ticketId: ticket.id,
          descricao: message,
          categoria: category_hint
        }
      });

      if (analysisError) {
        console.error('Error analyzing ticket:', analysisError);
      } else {
        console.log('Ticket analysis completed:', analysisResult);
      }
    } catch (error) {
      console.error('Error calling analyze-ticket function:', error);
    }

    // Buscar dados atualizados do ticket após análise
    const { data: updatedTicket } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket.id)
      .single();

    const finalTicket = updatedTicket || ticket;

    console.log('Ticket created successfully:', finalTicket.codigo_ticket);

    // Resposta de sucesso
    return new Response(JSON.stringify({
      action: 'ticket_created',
      success: true,
      ticket_id: finalTicket.id,
      codigo_ticket: finalTicket.codigo_ticket,
      status: finalTicket.status,
      categoria: finalTicket.categoria,
      subcategoria: finalTicket.subcategoria,
      prioridade: finalTicket.prioridade,
      data_limite_sla: finalTicket.data_limite_sla,
      message: `Ticket ${finalTicket.codigo_ticket} criado com sucesso!`,
      metadata: metadata || {}
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