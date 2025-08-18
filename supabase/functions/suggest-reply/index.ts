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
    const { ticketId } = await req.json();
    
    if (!ticketId) {
      throw new Error('ticketId is required');
    }

    console.log('Generating AI suggestion for ticket:', ticketId);

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

    // 2. Fetch recent messages for context
    const { data: messages } = await supabase
      .from('ticket_mensagens')
      .select('mensagem, direcao, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 3. Hybrid RAG Retrieval: Search relevant documents
    console.log('Searching for relevant documents for ticket:', ticket.categoria, ticket.subcategoria);
    
    // Generate search terms from ticket description, category, and subcategory
    const searchTerms = [
      ...ticket.descricao_problema.toLowerCase().split(/\s+/).filter(term => term.length > 3).slice(0, 5),
      ...(ticket.categoria ? [ticket.categoria.toLowerCase()] : []),
      ...(ticket.subcategoria ? ticket.subcategoria.toLowerCase().split(/\s+/).filter(term => term.length > 3) : [])
    ].filter((term, index, self) => self.indexOf(term) === index).slice(0, 8); // Deduplicate and limit

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
      .slice(0, 4); // Limit results

    // Process Knowledge Base articles
    const kbArticles = kbResults
      .filter(result => !result.error && result.data)
      .flatMap(result => result.data)
      .filter((article, index, self) =>
        index === self.findIndex(a => a.titulo === article.titulo)
      ) // Deduplicate
      .slice(0, 4); // Limit results

    console.log(`Found ${ragDocuments.length} RAG documents and ${kbArticles.length} KB articles`);

    // 4. Fetch similar recent tickets from same unit
    const { data: similarTickets } = await supabase
      .from('tickets')
      .select('descricao_problema, resposta_resolucao, prioridade, status, resolvido_em')
      .eq('unidade_id', ticket.unidade_id)
      .neq('id', ticketId)
      .not('resposta_resolucao', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

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
    
    contextSections.push(`INFORMAÇÕES DO TICKET:
- Código: ${ticket.codigo_ticket}
- Unidade: ${ticket.unidades?.grupo || ticket.unidade_id}
- Categoria: ${ticket.categoria || 'Não especificada'}
- Prioridade: ${ticket.prioridade}
- Status: ${ticket.status}
- Descrição: ${ticket.descricao_problema}
- Reaberto: ${ticket.reaberto_count} vez(es)`);

    if (messages && messages.length > 0) {
      contextSections.push(`HISTÓRICO DE MENSAGENS:
${messages.map(m => `[${m.direcao}] ${m.mensagem}`).join('\n')}`);
    }

    // Add RAG documents if found
    if (ragDocuments.length > 0) {
      contextSections.push(`=== DOCUMENTOS RAG ===
${ragDocuments.map(doc => {
        const title = doc.metadata?.title || 'Documento';
        const category = doc.metadata?.category || 'Geral';
        return `**${title}** (${category})\n${doc.content.substring(0, 300)}...`;
      }).join('\n\n')}`);
    }

    // Add Knowledge Base articles if found
    if (kbArticles.length > 0) {
      contextSections.push(`=== BASE DE CONHECIMENTO ===
${kbArticles.map(a => `**${a.titulo}** (${a.categoria})\n${a.conteudo.substring(0, 300)}...\nTags: ${a.tags?.join(', ') || 'Nenhuma'}`).join('\n\n')}`);
    }

    if (similarTickets && similarTickets.length > 0) {
      contextSections.push(`TICKETS SIMILARES DA UNIDADE:
${similarTickets.map(t => `Problema: ${t.descricao_problema.substring(0, 100)}...\nResolução: ${t.resposta_resolucao?.substring(0, 150)}...`).join('\n\n')}`);
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

    // 7. Build AI prompt with strict brevity rules
    const systemPrompt = `${aiSettings.base_conhecimento_prompt}

REGRAS OBRIGATÓRIAS:
- NUNCA use saudações (olá, oi, bom dia, etc.)
- NUNCA use despedidas (tchau, abraços, atenciosamente, etc.)
- Máximo 2-4 frases curtas OU 3 tópicos com bullet points
- Seja direto, específico e objetivo
- Use informações da base de conhecimento e tickets similares quando relevante
- Forneça uma resposta clara e acionável
- Se necessário, sugira próximos passos
- Mantenha o tom adequado ao contexto da franquia

FORMATO: Resposta direta sem introdução ou conclusão.`;

    const userPrompt = `Com base no contexto abaixo, sugira uma resposta profissional para este ticket:

${context}

Gere uma sugestão de resposta que o atendente possa usar diretamente ou adaptar.`;

    // 8. Call OpenAI
    const model = aiSettings.modelo_sugestao || 'gpt-4o-mini';
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

    console.log('Calling OpenAI with model:', model);

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
    const { data: suggestion, error: saveError } = await supabase
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
          context_sections: contextSections.length,
          search_terms: searchTerms,
          rag_hits: ragDocuments.length,
          kb_hits: kbArticles.length,
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
      console.error('Error saving suggestion:', saveError);
      throw saveError;
    }

    console.log('AI suggestion generated successfully');

    return new Response(JSON.stringify({
      suggestionId: suggestion.id,
      resposta: sanitized,
      rag_hits: ragDocuments.length,
      kb_hits: kbArticles.length,
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