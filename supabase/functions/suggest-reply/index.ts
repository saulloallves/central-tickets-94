import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { ticketId } = await req.json();
    
    if (!ticketId) {
      throw new Error('ticketId is required');
    }

    console.log('Generating suggestion for ticket:', ticketId);

    // 1. Fetch AI settings FIRST
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

    console.log('AI Settings loaded:', {
      api_provider: aiSettings.api_provider,
      modelo_sugestao: aiSettings.modelo_sugestao,
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

    // Hybrid RAG Retrieval: Search relevant documents
    console.log('Searching for relevant documents for suggestion:', ticket.descricao_problema);
    
    // Generate search terms from ticket description and category
    const description = ticket.descricao_problema.toLowerCase();
    
    // Extract key terms and add common variations
    const basicTerms = description.split(/\s+/).filter(term => term.length > 2);
    const keyTerms = [
      ...basicTerms.filter(term => term.length > 3).slice(0, 5),
      ...(ticket.categoria ? [ticket.categoria.toLowerCase()] : [])
    ];

    // Add specific search patterns for common queries
    const enhancedTerms = [...keyTerms];
    if (description.includes('senha') || description.includes('password') || description.includes('reset')) {
      enhancedTerms.push('senha', 'reset', 'login', 'resetar');
    }
    if (description.includes('sistema') || description.includes('system')) {
      enhancedTerms.push('sistema', 'login', 'acesso');
    }
    if (description.includes('relatório') || description.includes('report')) {
      enhancedTerms.push('relatório', 'relatórios', 'gerar', 'download');
    }

    const searchTerms = [...new Set(enhancedTerms)].slice(0, 8); // Deduplicate and limit

    console.log('Search terms:', searchTerms);

    // Search in RAG_DOCUMENTOS table
    const ragPromises = searchTerms.map(term => 
      supabase
        .from('RAG DOCUMENTOS')
        .select('content, metadata')
        .or(`content.ilike.%${term}%,metadata->>title.ilike.%${term}%,metadata->>category.ilike.%${term}%`)
        .limit(2)
    );

    // Search in knowledge_articles table with advanced filtering
    let kbBaseQuery = supabase
      .from('knowledge_articles')
      .select('id, titulo, conteudo, categoria, tags')
      .eq('ativo', true);

    // Only filter by approved if use_only_approved is true
    if (aiSettings.use_only_approved) {
      kbBaseQuery = kbBaseQuery.eq('aprovado', true);
    }

    // Apply category filtering if configured
    if (aiSettings.allowed_categories && aiSettings.allowed_categories.length > 0) {
      kbBaseQuery = kbBaseQuery.in('categoria', aiSettings.allowed_categories);
    }

    // Create more comprehensive search for KB articles
    const kbPromises = [
      // Search by exact description match prioritizing content
      supabase
        .from('knowledge_articles')
        .select('id, titulo, conteudo, categoria, tags')
        .eq('ativo', true)
        .eq('aprovado', aiSettings.use_only_approved || true)
        .or(`conteudo.ilike.%${ticket.descricao_problema.toLowerCase()}%,titulo.ilike.%${ticket.descricao_problema.toLowerCase()}%`)
        .limit(5),
      // Search by individual terms prioritizing content over title
      ...searchTerms.map(term =>
        supabase
          .from('knowledge_articles')
          .select('id, titulo, conteudo, categoria, tags')
          .eq('ativo', true)
          .eq('aprovado', aiSettings.use_only_approved || true)
          .or(`conteudo.ilike.%${term}%,titulo.ilike.%${term}%,categoria.ilike.%${term}%`)
          .limit(3)
      ),
      // Get more general articles to ensure comprehensive coverage
      supabase
        .from('knowledge_articles')
        .select('id, titulo, conteudo, categoria, tags')
        .eq('ativo', true)
        .eq('aprovado', aiSettings.use_only_approved || true)
        .limit(10)
    ];

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

    // Process Knowledge Base articles with blocked tags filtering
    let kbArticles = kbResults
      .filter(result => !result.error && result.data)
      .flatMap(result => result.data)
      .filter((article, index, self) =>
        index === self.findIndex(a => a.titulo === article.titulo)
      ); // Deduplicate

    // Filter out articles with blocked tags
    if (aiSettings.blocked_tags && aiSettings.blocked_tags.length > 0) {
      kbArticles = kbArticles.filter(article => {
        if (!article.tags) return true;
        return !article.tags.some(tag => aiSettings.blocked_tags.includes(tag));
      });
    }

    kbArticles = kbArticles.slice(0, 8); // Increased limit for more comprehensive responses

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

    // Add RAG documents if found
    if (ragDocuments.length > 0) {
      contextSections.push(`=== DOCUMENTOS RAG ===
${ragDocuments.map(doc => {
        const title = doc.metadata?.title || 'Documento';
        const category = doc.metadata?.category || 'Geral';
        return `**${title}** (${category})\n${doc.content.substring(0, 200)}...`;
      }).join('\n\n')}`);
    }

    // Add Knowledge Base articles if found - send full content for better context
    if (kbArticles.length > 0 || forcedArticles.length > 0) {
      const allKBArticles = [...forcedArticles, ...kbArticles];
      contextSections.push(`=== BASE DE CONHECIMENTO COMPLETA ===
${allKBArticles.map(a => `**${a.titulo}** (${a.categoria})\n${a.conteudo}\nTags: ${a.tags?.join(', ') || 'Nenhuma'}`).join('\n\n---\n\n')}`);
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

    // 7. Build AI prompt with strict brevity rules and style
    const basePrompt = aiSettings.prompt_sugestao || 
      `Você é um assistente especializado em suporte técnico para atendentes de uma franquia.`;
    
    const stylePrompt = aiSettings.estilo_resposta === 'formal' ? 
      'Use linguagem formal e técnica.' :
      aiSettings.estilo_resposta === 'amigavel' ?
      'Use linguagem amigável e acessível.' :
      'Use linguagem técnica mas compreensível.';

    const systemPrompt = `${basePrompt}

${stylePrompt}

REGRAS OBRIGATÓRIAS:
- NUNCA use saudações (olá, oi, bom dia, etc.)
- NUNCA use despedidas (tchau, abraços, atenciosamente, etc.)
- Máximo 2-4 frases curtas OU 3 tópicos com bullet points
- Seja direto, específico e objetivo
- Ajude o atendente com informações, estratégias e sugestões
- Use a base de conhecimento para fundamentar suas respostas
- Considere o contexto do ticket
- Forneça respostas acionáveis e específicas

FORMATO: Resposta direta sem introdução ou conclusão.`;

    const userPrompt = `CONTEXTO:
${context}

SUGESTAO DE RESPOSTA:
Gere uma resposta concisa e útil para o atendente.`;

    // 8. Determine API endpoint and model based on provider
    let apiUrl: string;
    let apiKey: string;
    let apiHeaders: Record<string, string>;
    let model: string;

    if (aiSettings.api_provider === 'lambda') {
      apiUrl = `${aiSettings.api_base_url}/chat/completions`;
      apiKey = Deno.env.get('LAMBDA_API_KEY')!;
      model = aiSettings.modelo_sugestao || 'llama-4-maverick-17b-128e-instruct-fp8';
      
      apiHeaders = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      // Add custom headers if configured
      if (aiSettings.custom_headers && typeof aiSettings.custom_headers === 'object') {
        Object.assign(apiHeaders, aiSettings.custom_headers);
      }
    } else {
      // OpenAI or other providers
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      apiKey = Deno.env.get('OPENAI_API_KEY')!;
      model = aiSettings.modelo_sugestao || 'gpt-5-2025-08-07';
      
      apiHeaders = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    }

    if (!apiKey) {
      throw new Error(`${aiSettings.api_provider.toUpperCase()} API key not configured`);
    }

    // Build request payload based on model and provider
    const isNewerOpenAIModel = model.includes('gpt-4.1') || model.includes('gpt-5') || model.includes('o3') || model.includes('o4');
    
    const requestBody: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    };

    // Set parameters based on provider and model
    if (aiSettings.api_provider === 'lambda') {
      // Lambda API supports temperature and max_tokens
      requestBody.temperature = aiSettings.temperatura_sugestao || 0.7;
      requestBody.max_tokens = aiSettings.max_tokens_sugestao || 1000;
      requestBody.top_p = 1.0;
      requestBody.frequency_penalty = 0;
      requestBody.presence_penalty = 0;
    } else if (isNewerOpenAIModel) {
      // Newer OpenAI models use max_completion_tokens and don't support temperature
      requestBody.max_completion_tokens = aiSettings.max_tokens_sugestao || 1000;
      requestBody.frequency_penalty = 0;
      requestBody.presence_penalty = 0;
    } else {
      // Legacy OpenAI models
      requestBody.max_tokens = aiSettings.max_tokens_sugestao || 1000;
      requestBody.temperature = aiSettings.temperatura_sugestao || 0.7;
      requestBody.top_p = 1.0;
      requestBody.frequency_penalty = 0;
      requestBody.presence_penalty = 0;
    }

    console.log('Calling AI API with model:', model, 'Provider:', aiSettings.api_provider);

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`AI API error: ${errorText}`);
    }

    const apiData = await apiResponse.json();
    const rawResponse = apiData.choices[0].message.content;
    
    // Sanitize the AI output
    const { sanitized, removed_greeting, removed_signoff } = sanitizeOutput(rawResponse);

    // Save to database
    const { data: suggestionRecord, error: saveError } = await supabase
      .from('ticket_ai_interactions')
      .insert({
        ticket_id: ticketId,
        kind: 'suggestion',
        resposta: sanitized,
        model,
        params: requestBody,
        log: {
          prompt: userPrompt,
          system_prompt: systemPrompt,
          api_provider: aiSettings.api_provider,
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
          api_response: apiData
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving suggestion:', saveError);
      throw saveError;
    }

    // Track knowledge article usage
    const allUsedArticles = [...forcedArticles, ...kbArticles];
    if (allUsedArticles.length > 0) {
      const usageRecords = allUsedArticles.map(article => ({
        interaction_id: suggestionRecord.id,
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

    console.log('AI suggestion generated successfully');

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
    console.error('Error in suggest-reply function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});