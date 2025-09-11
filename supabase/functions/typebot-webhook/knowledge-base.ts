/**
 * Knowledge Base search and suggestion engine
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { extractSearchTerms, limparTexto, prepararMensagemParaFranqueado } from './text-utils.ts';
import { gerarRespostaComContexto } from './rag-engine.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

export async function searchKnowledgeBase(message: string) {
  console.log('Searching knowledge base for:', message);
  
  const terms = extractSearchTerms(message);
  const orFilter = terms.length
    ? terms.map(t => `titulo.ilike.%${t}%,conteudo.ilike.%${t}%,categoria.ilike.%${t}%`).join(',')
    : null;

  let query = supabase
    .from('knowledge_articles')
    .select('id, titulo, conteudo, categoria, tags')
    .eq('ativo', true)
    .eq('aprovado', true)
    .eq('usado_pela_ia', true)
    .limit(5);
    
  if (orFilter) query = query.or(orFilter);
  const { data: articles, error } = await query;

  if (error) {
    console.error('Error fetching KB articles:', error);
    return { hasAnswer: false, articles: [] };
  }

  const artigosTop2 = (articles || [])
    .sort((a,b) => limparTexto(a.conteudo).length - limparTexto(b.conteudo).length)
    .slice(0,2);

  if (artigosTop2.length > 0 && openaiApiKey) {
    try {
      const respostaKB = await gerarRespostaComContexto(artigosTop2, message);
      
      try {
        const payload = JSON.parse(respostaKB);
        const textoFinal = prepararMensagemParaFranqueado(payload.texto);
        
        if (textoFinal && !textoFinal.includes('Não encontrei informações suficientes')) {
          return {
            hasAnswer: true,
            answer: textoFinal,
            sources: artigosTop2.map(a => ({ id: a.id, titulo: a.titulo })),
            fontes_utilizadas: payload.fontes || []
          };
        }
      } catch (e) {
        const textoFinal = prepararMensagemParaFranqueado(respostaKB);
        if (textoFinal && !textoFinal.includes('Não encontrei informações suficientes')) {
          return {
            hasAnswer: true,
            answer: textoFinal,
            sources: artigosTop2.map(a => ({ id: a.id, titulo: a.titulo }))
          };
        }
      }
    } catch (error) {
      console.error('Error calling KB generation:', error);
    }
  }

  return { hasAnswer: false, articles: artigosTop2 };
}

export async function generateDirectSuggestion(message: string, relevantArticles: any[] = []) {
  if (relevantArticles.length === 0) {
    console.log('No relevant articles found, returning default message');
    return 'Não tenho conhecimento sobre isso, vou abrir um ticket para que nosso suporte te ajude.';
  }

  if (!openaiApiKey) {
    console.log('OpenAI API key not available for direct suggestion');
    return 'Não tenho conhecimento sobre isso, vou abrir um ticket para que nosso suporte te ajude.';
  }

  try {
    const { data: aiSettings } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .maybeSingle();

    const modelToUse = aiSettings?.modelo_sugestao || 'gpt-4o';
    const apiProvider = aiSettings?.api_provider || 'openai';
    
    let apiUrl = 'https://api.openai.com/v1/chat/completions';
    let authToken = openaiApiKey;
    let apiHeaders = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
    
    if (apiProvider === 'lambda' && aiSettings?.api_base_url) {
      apiUrl = `${aiSettings.api_base_url}/chat/completions`;
      authToken = aiSettings.api_key || openaiApiKey;
      apiHeaders.Authorization = `Bearer ${authToken}`;
      
      if (aiSettings.custom_headers && typeof aiSettings.custom_headers === 'object') {
        Object.assign(apiHeaders, aiSettings.custom_headers);
      }
    }

    const kbContext = relevantArticles.map(article => 
      `Título: ${article.titulo}\nConteúdo: ${limparTexto(article.conteudo)}`
    ).join('\n\n');

    const promptDirecto = `Base de conhecimento disponível:
${kbContext}

Franqueado perguntou: "${message}"

INSTRUÇÕES:
1. Use APENAS as informações da base de conhecimento acima
2. Se a base de conhecimento não tem informação suficiente para responder completamente, responda EXATAMENTE: "Não tenho conhecimento sobre isso, vou abrir um ticket para que nosso suporte te ajude."
3. Se tem informação relevante na base, responda de forma DIRETA e OBJETIVA
4. Sem saudações ou cumprimentos
5. Máximo 80 palavras
6. Vá direto ao ponto

Resposta:`;

    const requestBody = {
      model: modelToUse,
      messages: [
        {
          role: 'system',
          content: 'Você responde baseado EXCLUSIVAMENTE na base de conhecimento fornecida. Se não tiver informação suficiente, use EXATAMENTE a frase padrão indicada.'
        },
        {
          role: 'user',
          content: promptDirecto
        }
      ]
    };

    if (apiProvider === 'lambda') {
      requestBody.temperature = aiSettings?.temperatura_sugestao || 0.3;
      requestBody.max_tokens = aiSettings?.max_tokens_sugestao || 150;
    } else {
      requestBody.max_tokens = aiSettings?.max_tokens_sugestao || 150;
      requestBody.temperature = aiSettings?.temperatura_sugestao || 0.3;
    }

    console.log('Generating direct suggestion with model:', modelToUse);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const aiResponse = await response.json();
      const suggestion = aiResponse.choices?.[0]?.message?.content;
      
      if (suggestion) {
        console.log('Direct suggestion generated successfully');
        return suggestion.trim();
      }
    } else {
      console.error('Error calling AI API for direct suggestion:', await response.text());
    }
  } catch (error) {
    console.error('Error generating direct suggestion:', error);
  }

  return 'Não tenho conhecimento sobre isso, vou abrir um ticket para que nosso suporte te ajude.';
}