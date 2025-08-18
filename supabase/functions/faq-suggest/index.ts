import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pergunta } = await req.json();

    if (!pergunta || typeof pergunta !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Pergunta é obrigatória' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('FAQ suggestion requested for:', pergunta);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get AI settings
    const { data: settings, error: settingsError } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .single();

    if (settingsError || !settings) {
      console.error('Error fetching AI settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Configurações de IA não encontradas' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Hybrid RAG Retrieval: Search relevant documents
    console.log('Searching for relevant documents for:', pergunta);
    
    // Search keywords from the question (simple keyword extraction)
    const searchTerms = pergunta.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 3)
      .slice(0, 5); // Limit to first 5 meaningful words
    
    console.log('Search terms:', searchTerms);

    // 1. Search in RAG_DOCUMENTOS table
    const ragPromises = searchTerms.map(term => 
      supabase
        .from('RAG DOCUMENTOS')
        .select('content, metadata')
        .or(`content.ilike.%${term}%,metadata->>title.ilike.%${term}%,metadata->>category.ilike.%${term}%`)
        .limit(3)
    );

    // 2. Search in knowledge_articles table with AI settings filtering
    const kbQuery = supabase
      .from('knowledge_articles')
      .select('id, titulo, conteudo, categoria, tags')
      .eq('ativo', true)
      .eq('aprovado', settings.use_only_approved || true);

    // Apply category filtering if configured
    if (settings.allowed_categories && settings.allowed_categories.length > 0) {
      kbQuery.in('categoria', settings.allowed_categories);
    }

    const kbPromises = searchTerms.map(term =>
      kbQuery
        .or(`titulo.ilike.%${term}%,conteudo.ilike.%${term}%,categoria.ilike.%${term}%`)
        .limit(3)
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
      .slice(0, 5); // Limit results

    // Process Knowledge Base articles with blocked tags filtering
    let kbArticles = kbResults
      .filter(result => !result.error && result.data)
      .flatMap(result => result.data)
      .filter((article, index, self) =>
        index === self.findIndex(a => a.titulo === article.titulo)
      ); // Deduplicate

    // Filter out articles with blocked tags
    if (settings.blocked_tags && settings.blocked_tags.length > 0) {
      kbArticles = kbArticles.filter(article => {
        if (!article.tags) return true;
        return !article.tags.some(tag => settings.blocked_tags.includes(tag));
      });
    }

    kbArticles = kbArticles.slice(0, 5); // Limit results

    // Add forced articles if configured
    let forcedArticles = [];
    if (settings.forced_article_ids && settings.forced_article_ids.length > 0) {
      const { data: forced } = await supabase
        .from('knowledge_articles')
        .select('id, titulo, conteudo, categoria, tags')
        .in('id', settings.forced_article_ids)
        .eq('ativo', true);
      
      forcedArticles = forced || [];
    }

    console.log(`Found ${ragDocuments.length} RAG documents, ${kbArticles.length} KB articles, ${forcedArticles.length} forced articles`);

    // Build knowledge base context from relevant documents only
    let knowledgeBase = '';

    // Add RAG documents
    if (ragDocuments.length > 0) {
      knowledgeBase += '=== DOCUMENTOS RAG ===\n';
      ragDocuments.forEach((doc, index) => {
        const title = doc.metadata?.title || `Documento ${index + 1}`;
        const category = doc.metadata?.category || 'Geral';
        knowledgeBase += `**${title}** (${category})\n${doc.content}\n\n`;
      });
    }

    // Add forced articles first
    if (forcedArticles.length > 0) {
      knowledgeBase += '=== ARTIGOS SEMPRE INCLUÍDOS ===\n';
      forcedArticles.forEach(article => {
        knowledgeBase += `**${article.titulo}** (${article.categoria})\n${article.conteudo}\nTags: ${article.tags?.join(', ') || 'Nenhuma'}\n\n`;
      });
    }

    // Add Knowledge Base articles
    if (kbArticles.length > 0) {
      knowledgeBase += '=== ARTIGOS BASE DE CONHECIMENTO ===\n';
      kbArticles.forEach(article => {
        knowledgeBase += `**${article.titulo}** (${article.categoria})\n${article.conteudo}\nTags: ${article.tags?.join(', ') || 'Nenhuma'}\n\n`;
      });
    }

    // Fallback: if no relevant documents found, inform AI
    if (knowledgeBase.trim() === '') {
      knowledgeBase = 'NENHUM DOCUMENTO RELEVANTE ENCONTRADO PARA ESTA PERGUNTA.\nSugira ao usuário abrir um ticket para atendimento especializado.';
    }

    // Prepare OpenAI prompt with style
    const basePrompt = settings.base_conhecimento_prompt || 
      `Você é um assistente especializado em FAQ para franquias.`;
    
    const stylePrompt = settings.estilo_resposta === 'formal' ? 
      'Use linguagem formal e técnica.' :
      settings.estilo_resposta === 'amigavel' ?
      'Use linguagem amigável e acessível.' :
      'Use linguagem técnica mas compreensível.';

    const systemPrompt = `${basePrompt}

${stylePrompt}

BASE DE CONHECIMENTO:
${knowledgeBase}

Responda de forma clara e objetiva. Se não houver informação suficiente na base de conhecimento, informe que é necessário abrir um ticket.`;

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key não configurada' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Call OpenAI API
    const openAIPayload: any = {
      model: settings.modelo,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: pergunta }
      ],
      top_p: settings.top_p,
      frequency_penalty: settings.frequency_penalty,
      presence_penalty: settings.presence_penalty
    };

    // Add model-specific parameters
    if (['gpt-4o', 'gpt-4o-mini'].includes(settings.modelo)) {
      openAIPayload.max_tokens = settings.max_tokens;
      openAIPayload.temperature = settings.temperatura;
    } else {
      openAIPayload.max_completion_tokens = settings.max_tokens;
      // Don't add temperature for newer models
    }

    console.log('Calling OpenAI with model:', settings.modelo);

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openAIPayload),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro na IA de sugestões' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const openAIData = await openAIResponse.json();
    const resposta = openAIData.choices[0].message.content;

    console.log('OpenAI response generated successfully');

    // Log the interaction (will be saved when user decides)
    const logPromptFaq = {
      system_prompt: systemPrompt,
      user_question: pergunta,
      ai_response: resposta,
      model: settings.modelo,
      temperature: settings.temperatura,
      max_tokens: settings.max_tokens,
      search_terms: searchTerms,
      rag_hits: ragDocuments.length,
      kb_hits: kbArticles.length,
      forced_articles: forcedArticles.length,
      total_context_length: knowledgeBase.length,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify({
        resposta_ia_sugerida: resposta,
        log_prompt_faq: logPromptFaq,
        articles_found: ragDocuments.length + kbArticles.length + forcedArticles.length,
        rag_hits: ragDocuments.length,
        kb_hits: kbArticles.length,
        forced_articles: forcedArticles.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in faq-suggest function:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});