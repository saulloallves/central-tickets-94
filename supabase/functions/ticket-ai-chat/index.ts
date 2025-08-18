import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, mensagem, userId } = await req.json();
    
    if (!ticketId || !mensagem) {
      throw new Error('ticketId and mensagem are required');
    }

    console.log('Processing AI chat for ticket:', ticketId);

    // 1. Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades(id, grupo),
        colaboradores(nome_completo, email)
      `)
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketError) {
      console.error('Error fetching ticket:', ticketError);
      throw new Error(`Database error: ${ticketError.message}`);
    }

    if (!ticket) {
      console.error('Ticket not found with ID:', ticketId);
      throw new Error('Ticket not found');
    }

    // 2. Fetch recent chat history
    const { data: chatHistory } = await supabase
      .from('ticket_ai_interactions')
      .select('mensagem, resposta, created_at')
      .eq('ticket_id', ticketId)
      .eq('kind', 'chat')
      .order('created_at', { ascending: false })
      .limit(5);

    // 3. Fetch recent ticket messages for context
    const { data: ticketMessages } = await supabase
      .from('ticket_mensagens')
      .select('mensagem, direcao, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(3);

    // 4. Hybrid RAG Retrieval: Search relevant documents
    console.log('Searching for relevant documents for chat question:', mensagem);
    
    // Generate search terms from current message and ticket description
    const searchTerms = [
      ...mensagem.toLowerCase().split(/\s+/).filter(term => term.length > 3).slice(0, 5),
      ...ticket.descricao_problema.toLowerCase().split(/\s+/).filter(term => term.length > 3).slice(0, 3),
      ...(ticket.categoria ? [ticket.categoria.toLowerCase()] : [])
    ].filter((term, index, self) => self.indexOf(term) === index).slice(0, 6); // Deduplicate and limit

    console.log('Search terms:', searchTerms);

    // Search in RAG_DOCUMENTOS table
    const ragPromises = searchTerms.map(term => 
      supabase
        .from('RAG DOCUMENTOS')
        .select('content, metadata')
        .or(`content.ilike.%${term}%,metadata->>title.ilike.%${term}%,metadata->>category.ilike.%${term}%`)
        .limit(2)
    );

    // Search in knowledge_articles table  
    const kbPromises = searchTerms.map(term =>
      supabase
        .from('knowledge_articles')
        .select('titulo, conteudo, categoria, tags')
        .eq('ativo', true)
        .or(`titulo.ilike.%${term}%,conteudo.ilike.%${term}%,categoria.ilike.%${term}%`)
        .limit(2)
    );

    // Execute all searches in parallel
    const [ragResults, kbResults] = await Promise.all([
      Promise.all(ragPromises),
      Promise.all(kbPromises)
    ]);

    // Process RAG documents
    const ragDocuments = ragResults
      .filter(result => !result.error && result.data)
      .flatMap(result => result.data)
      .filter((doc, index, self) => 
        index === self.findIndex(d => d.content === doc.content)
      ) // Deduplicate
      .slice(0, 3); // Limit results

    // Process Knowledge Base articles
    const kbArticles = kbResults
      .filter(result => !result.error && result.data)
      .flatMap(result => result.data)
      .filter((article, index, self) =>
        index === self.findIndex(a => a.titulo === article.titulo)
      ) // Deduplicate
      .slice(0, 3); // Limit results

    console.log(`Found ${ragDocuments.length} RAG documents and ${kbArticles.length} KB articles`);

    // 5. Fetch AI settings
    const { data: aiSettings, error: settingsError } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching AI settings:', settingsError);
      throw new Error(`AI settings error: ${settingsError.message}`);
    }

    if (!aiSettings) {
      console.error('No active AI settings found');
      throw new Error('AI settings not configured');
    }

    // 6. Build context for AI
    const contextSections = [];
    
    contextSections.push(`CONTEXTO DO TICKET:
- Código: ${ticket.codigo_ticket}
- Unidade: ${ticket.unidades?.grupo || ticket.unidade_id}
- Categoria: ${ticket.categoria || 'Não especificada'}
- Prioridade: ${ticket.prioridade}
- Status: ${ticket.status}
- Descrição: ${ticket.descricao_problema}`);

    if (ticketMessages && ticketMessages.length > 0) {
      contextSections.push(`MENSAGENS RECENTES:
${ticketMessages.map(m => `[${m.direcao}] ${m.mensagem}`).join('\n')}`);
    }

    if (chatHistory && chatHistory.length > 0) {
      contextSections.push(`CONVERSA ANTERIOR COM IA:
${chatHistory.reverse().map(c => `P: ${c.mensagem}\nR: ${c.resposta}`).join('\n\n')}`);
    }

    // Add RAG documents if found
    if (ragDocuments.length > 0) {
      contextSections.push(`=== DOCUMENTOS RAG ===
${ragDocuments.map(doc => {
        const title = doc.metadata?.title || 'Documento';
        const category = doc.metadata?.category || 'Geral';
        return `**${title}** (${category})\n${doc.content.substring(0, 200)}...`;
      }).join('\n\n')}`);
    }

    // Add Knowledge Base articles if found
    if (kbArticles.length > 0) {
      contextSections.push(`=== BASE DE CONHECIMENTO ===
${kbArticles.map(a => `**${a.titulo}** (${a.categoria})\n${a.conteudo.substring(0, 200)}...\nTags: ${a.tags?.join(', ') || 'Nenhuma'}`).join('\n\n')}`);
    }

    const context = contextSections.join('\n\n');

    // 7. Build AI prompt
    const systemPrompt = `Você é um assistente especializado em suporte técnico para atendentes de uma franquia.

Estilo de resposta: ${aiSettings.estilo_resposta}

Regras:
- Seja ${aiSettings.estilo_resposta.toLowerCase()}, prático e direto
- Ajude o atendente com informações, estratégias e sugestões
- Use a base de conhecimento para fundamentar suas respostas
- Considere o contexto do ticket e histórico de mensagens
- Forneça respostas acionáveis e específicas
- Mantenha tom profissional mas acessível`;

    const userPrompt = `CONTEXTO:
${context}

PERGUNTA DO ATENDENTE:
${mensagem}

Responda de forma clara e útil, considerando todo o contexto do ticket.`;

    // 8. Call OpenAI
    const model = aiSettings.modelo_chat || 'gpt-4o-mini';
    const isNewerModel = model.includes('gpt-4.1') || model.includes('gpt-5') || model.includes('o3') || model.includes('o4');
    
    const requestBody: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    };

    if (isNewerModel) {
      requestBody.max_completion_tokens = aiSettings.max_tokens || 800;
    } else {
      requestBody.max_tokens = aiSettings.max_tokens || 800;
      requestBody.temperature = aiSettings.temperatura || 0.3;
      requestBody.top_p = aiSettings.top_p || 1.0;
    }

    console.log('Calling OpenAI for chat with model:', model);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = openaiData.choices[0].message.content;

    // 9. Save to database
    const { data: chatRecord, error: saveError } = await supabase
      .from('ticket_ai_interactions')
      .insert({
        ticket_id: ticketId,
        kind: 'chat',
        user_id: userId,
        mensagem,
        resposta: aiResponse,
        model,
        params: requestBody,
        log: {
          prompt: userPrompt,
          system_prompt: systemPrompt,
          context_sections: contextSections.length,
          search_terms: searchTerms,
          rag_hits: ragDocuments.length,
          kb_hits: kbArticles.length,
          total_context_length: context.length,
          openai_response: openaiData
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving chat:', saveError);
      throw saveError;
    }

    console.log('AI chat processed successfully');

    return new Response(JSON.stringify({
      resposta: aiResponse,
      rag_hits: ragDocuments.length,
      kb_hits: kbArticles.length,
      total_context_length: context.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ticket-ai-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});