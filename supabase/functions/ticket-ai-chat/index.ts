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
    console.log('=== TICKET AI CHAT DEBUG START ===');
    const { ticketId, mensagem, userId } = await req.json();
    console.log('Request data:', { ticketId, mensagem, userId });
    
    if (!ticketId || !mensagem) {
      console.error('Missing required fields:', { ticketId: !!ticketId, mensagem: !!mensagem });
      throw new Error('ticketId and mensagem are required');
    }

    console.log('Processing AI chat for ticket:', ticketId);

    // 1. Fetch AI settings FIRST
    console.log('Fetching AI settings...');
    const { data: aiSettings, error: settingsError } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .maybeSingle();
    
    console.log('AI settings result:', { aiSettings, settingsError });

    if (settingsError) {
      console.error('Error fetching AI settings:', settingsError);
      throw new Error(`AI settings error: ${settingsError.message}`);
    }

    if (!aiSettings) {
      console.error('No active AI settings found');
      throw new Error('AI settings not configured');
    }

    console.log('AI Settings loaded:', {
      modelo_chat: aiSettings.modelo_chat,
      use_only_approved: aiSettings.use_only_approved,
      allowed_categories: aiSettings.allowed_categories,
      blocked_tags: aiSettings.blocked_tags,
      forced_article_ids: aiSettings.forced_article_ids
    });

    // 2. Fetch ticket details
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

    // 3. Fetch recent chat history
    const { data: chatHistory } = await supabase
      .from('ticket_ai_interactions')
      .select('mensagem, resposta, created_at')
      .eq('ticket_id', ticketId)
      .eq('kind', 'chat')
      .order('created_at', { ascending: false })
      .limit(5);

    // 4. Fetch recent ticket messages for context
    const { data: ticketMessages } = await supabase
      .from('ticket_mensagens')
      .select('mensagem, direcao, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(3);

    // 5. Enhanced RAG Retrieval: Get comprehensive knowledge base access
    console.log('Searching for relevant documents for chat question:', mensagem);
    
    // Generate search terms from current message and ticket description
    const searchTerms = [
      ...mensagem.toLowerCase().split(/\s+/).filter(term => term.length > 2).slice(0, 8),
      ...ticket.descricao_problema.toLowerCase().split(/\s+/).filter(term => term.length > 2).slice(0, 5),
      ...(ticket.categoria ? [ticket.categoria.toLowerCase()] : []),
      // Add generic terms to help find relevant manuals
      'manual', 'procedimento', 'processo', 'cresci', 'perdi', 'atendimento', 'suporte'
    ].filter((term, index, self) => self.indexOf(term) === index).slice(0, 12);

    console.log('Search terms:', searchTerms);

    // Search in RAG_DOCUMENTOS table - focus on content
    const ragPromises = searchTerms.map(term => 
      supabase
        .from('RAG DOCUMENTOS')
        .select('content, metadata')
        .ilike('content', `%${term}%`)
        .limit(5)
    );

    // Get ALL active knowledge articles to ensure comprehensive access
    const allKnowledgeQuery = supabase
      .from('knowledge_articles')
      .select('id, titulo, conteudo, categoria, tags')
      .eq('ativo', true)
      .eq('aprovado', aiSettings.use_only_approved || true)
      .limit(50); // Get up to 50 articles for comprehensive coverage

    // Apply category filtering if configured
    if (aiSettings.allowed_categories && aiSettings.allowed_categories.length > 0) {
      allKnowledgeQuery.in('categoria', aiSettings.allowed_categories);
    }

    // Search specifically in content for relevant matches
    const specificKbPromises = searchTerms.map(term =>
      supabase
        .from('knowledge_articles')
        .select('id, titulo, conteudo, categoria, tags')
        .eq('ativo', true)
        .eq('aprovado', aiSettings.use_only_approved || true)
        .ilike('conteudo', `%${term}%`)
        .limit(5)
    );

    // Execute all searches in parallel
    const [ragResults, allKnowledgeResult, specificKbResults] = await Promise.all([
      Promise.all(ragPromises),
      allKnowledgeQuery,
      Promise.all(specificKbPromises)
    ]);

    // Process RAG documents
    const ragDocuments = ragResults
      .filter(result => !result.error && result.data)
      .flatMap(result => result.data)
      .filter((doc, index, self) => 
        index === self.findIndex(d => d.content === doc.content)
      ) // Deduplicate
      .slice(0, 5); // More RAG documents

    // Process Knowledge Base articles - prioritize comprehensive coverage
    let kbArticles = [];

    // First, add specifically matched articles
    const specificMatches = specificKbResults
      .filter(result => !result.error && result.data)
      .flatMap(result => result.data)
      .filter((article, index, self) =>
        index === self.findIndex(a => a.id === article.id)
      ); // Deduplicate by ID

    kbArticles = [...specificMatches];

    // Then add ALL available articles for comprehensive context
    if (allKnowledgeResult.data && !allKnowledgeResult.error) {
      const allArticles = allKnowledgeResult.data.filter(article => 
        !kbArticles.some(existing => existing.id === article.id)
      );
      kbArticles = [...kbArticles, ...allArticles];
    }

    // Filter out articles with blocked tags
    if (aiSettings.blocked_tags && aiSettings.blocked_tags.length > 0) {
      kbArticles = kbArticles.filter(article => {
        if (!article.tags) return true;
        return !article.tags.some(tag => aiSettings.blocked_tags.includes(tag));
      });
    }

    // Limit to most relevant articles but ensure comprehensive coverage
    kbArticles = kbArticles.slice(0, 20); // Significantly increased for full knowledge access

    // Add forced articles if configured
    let forcedArticles = [];
    if (aiSettings.forced_article_ids && aiSettings.forced_article_ids.length > 0) {
      const { data: forced } = await supabase
        .from('knowledge_articles')
        .select('id, titulo, conteudo, categoria, tags')
        .in('id', aiSettings.forced_article_ids)
        .eq('ativo', true);
      
      forcedArticles = forced || [];
    }

    console.log(`Found ${ragDocuments.length} RAG documents, ${kbArticles.length} KB articles, ${forcedArticles.length} forced articles`);

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
    if (kbArticles.length > 0 || forcedArticles.length > 0) {
      const allKBArticles = [...forcedArticles, ...kbArticles];
      contextSections.push(`=== BASE DE CONHECIMENTO ===
${allKBArticles.map(a => `**${a.titulo}** (${a.categoria})\n${a.conteudo.substring(0, 200)}...\nTags: ${a.tags?.join(', ') || 'Nenhuma'}`).join('\n\n')}`);
    }

    const context = contextSections.join('\n\n');

    // Sanitization function to remove greetings and ensure brevity
    const sanitizeOutput = (text: string): { sanitized: string, removed_greeting: boolean, removed_signoff: boolean } => {
      let sanitized = text.trim();
      let removed_greeting = false;
      let removed_signoff = false;
      
      // Remove common greetings (case insensitive)
      const greetingPatterns = [
        /^(olá|oi|bom dia|boa tarde|boa noite|prezado|caro)[^\n]*/gi,
        /^(hello|hi|dear)[^\n]*/gi
      ];
      
      for (const pattern of greetingPatterns) {
        if (pattern.test(sanitized)) {
          sanitized = sanitized.replace(pattern, '').trim();
          removed_greeting = true;
        }
      }
      
      // Remove common sign-offs
      const signoffPatterns = [
        /(atenciosamente|cordialmente|abraços|tchau|até mais|qualquer dúvida)[^\n]*$/gi,
        /(regards|best|sincerely|bye)[^\n]*$/gi,
        /se precisar de mais alguma coisa[^\n]*$/gi,
        /estou aqui para ajudar[^\n]*$/gi
      ];
      
      for (const pattern of signoffPatterns) {
        if (pattern.test(sanitized)) {
          sanitized = sanitized.replace(pattern, '').trim();
          removed_signoff = true;
        }
      }
      
      // Remove excessive whitespace and limit to 3 lines or 450 characters
      sanitized = sanitized.replace(/\n\s*\n/g, '\n').trim();
      const lines = sanitized.split('\n');
      if (lines.length > 3) {
        sanitized = lines.slice(0, 3).join('\n');
      }
      if (sanitized.length > 450) {
        sanitized = sanitized.substring(0, 450) + '...';
      }
      
      return { sanitized, removed_greeting, removed_signoff };
    };

    // 7. Build AI prompt - AI helps the support agent, not the customer directly
    const basePrompt = `Você é o assistente de IA da Cresci & Perdi, especializado em AJUDAR ATENDENTES de suporte.
Você conhece todos os processos, manuais e procedimentos da empresa.

IMPORTANTE: Você está conversando com um ATENDENTE/SUPORTE, não com o cliente final (franqueado).

COMO AJUDAR O ATENDENTE:
- Responda perguntas do atendente sobre como resolver problemas
- Sugira respostas que o atendente pode enviar ao cliente
- Forneça orientações baseadas nos manuais da Cresci & Perdi
- Ajude com procedimentos e processos internos
- Analise o contexto do ticket para dar sugestões específicas
- Seja um consultor técnico para o atendente

VOCÊ TEM ACESSO A:
- Toda a base de conhecimento e manuais da Cresci & Perdi
- Contexto completo do ticket atual
- Histórico de conversas do ticket
- Procedimentos operacionais da empresa`;
    
    const stylePrompt = aiSettings.estilo_resposta === 'formal' ? 
      'Use linguagem formal e técnica com o atendente.' :
      aiSettings.estilo_resposta === 'amigavel' ?
      'Use linguagem amigável e acessível com o atendente.' :
      'Use linguagem técnica mas compreensível com o atendente.';

    const systemPrompt = `${basePrompt}

${stylePrompt}

REGRAS PARA CONVERSAR COM O ATENDENTE:
- Fale diretamente com o atendente usando "você"
- NUNCA use saudações como "olá", "oi", "bom dia" no INÍCIO das respostas
- NUNCA use despedidas como "tchau", "abraços", "qualquer dúvida"
- Quando sugerir uma resposta ao cliente, deixe claro: "Você pode responder ao cliente:"
- Responda em 1-3 frases conversacionais e consultivas
- Se o atendente cumprimentar você, cumprimente de volta normalmente
- SEMPRE consulte a base de conhecimento da Cresci & Perdi quando relevante
- Seja um colega experiente ajudando o atendente

FORMATO: Resposta direta e consultiva, como um supervisor experiente orientando o atendente.`;

    const userPrompt = `CONTEXTO DO TICKET QUE O ATENDENTE ESTÁ RESOLVENDO:
${context}

PERGUNTA/SOLICITAÇÃO DO ATENDENTE:
${mensagem}

Ajude o atendente com informações da base de conhecimento da Cresci & Perdi.`;


    // 8. Call OpenAI using configured model and parameters
    const model = aiSettings.modelo_chat || 'gpt-5-2025-08-07';
    const isNewerModel = model.includes('gpt-4.1') || model.includes('gpt-5') || model.includes('o3') || model.includes('o4');
    
    const requestBody: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    };

    // Use configured parameters from AI settings
    if (isNewerModel) {
      requestBody.max_completion_tokens = aiSettings.max_tokens_chat || 800;
      requestBody.frequency_penalty = 0;
      requestBody.presence_penalty = 0;
    } else {
      requestBody.max_tokens = aiSettings.max_tokens_chat || 800;
      requestBody.temperature = aiSettings.temperatura_chat || 0.3;
      requestBody.top_p = 1.0;
      requestBody.frequency_penalty = 0;
      requestBody.presence_penalty = 0;
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
    const rawResponse = openaiData.choices[0].message.content;
    
    // Sanitize the AI output
    const { sanitized, removed_greeting, removed_signoff } = sanitizeOutput(rawResponse);

    // 9. Save to database
    const { data: chatRecord, error: saveError } = await supabase
      .from('ticket_ai_interactions')
      .insert({
        ticket_id: ticketId,
        kind: 'chat',
        user_id: userId,
        mensagem,
        resposta: sanitized,
        model,
        params: requestBody,
        log: {
          prompt: userPrompt,
          system_prompt: systemPrompt,
          context_sections: contextSections.length,
          search_terms: searchTerms,
          rag_hits: ragDocuments.length,
          kb_hits: kbArticles.length + forcedArticles.length,
          forced_articles: forcedArticles.length,
          total_context_length: context.length,
          used_sanitizer: true,
          removed_greeting,
          removed_signoff,
          original_length: rawResponse.length,
          sanitized_length: sanitized.length,
          openai_response: openaiData
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving chat:', saveError);
      throw saveError;
    }

    // Track knowledge article usage
    const allUsedArticles = [...forcedArticles, ...kbArticles];
    if (allUsedArticles.length > 0) {
      const usageRecords = allUsedArticles.map(article => ({
        interaction_id: chatRecord.id,
        ticket_id: ticketId,
        article_id: article.id,
        used_as: forcedArticles.some(f => f.id === article.id) ? 'forced' : 'context'
      }));

      const { error: usageError } = await supabase
        .from('knowledge_article_usage')
        .insert(usageRecords);

      if (usageError) {
        console.error('Error tracking article usage:', usageError);
      }
    }

    console.log('AI chat processed successfully');

    return new Response(JSON.stringify({
      resposta: sanitized,
      rag_hits: ragDocuments.length,
      kb_hits: kbArticles.length + forcedArticles.length,
      forced_articles: forcedArticles.length,
      total_context_length: context.length,
      sanitization: {
        removed_greeting,
        removed_signoff,
        original_length: rawResponse.length,
        sanitized_length: sanitized.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== TICKET AI CHAT ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
