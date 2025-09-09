import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { openAI } from './openai-client.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Recupera documentos relacionados usando busca híbrida (semântica + keyword)
 * Adaptado da tecnologia Z-API WhatsApp
 */
export async function encontrarDocumentosRelacionados(textoTicket: string, limiteResultados: number = 12) {
  try {
    console.log('🔍 Gerando embedding para:', textoTicket.substring(0, 100) + '...');
    
    const embeddingResponse = await openAI('embeddings', {
      model: 'text-embedding-3-small',
      input: textoTicket
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Embedding API error: ${await embeddingResponse.text()}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('🔎 Executando busca híbrida...');
    
    const { data: candidatos, error } = await supabase.rpc('match_documentos_hibrido', {
      query_embedding: queryEmbedding,
      query_text: textoTicket,
      match_count: limiteResultados,
      alpha: 0.5
    });

    if (error) {
      console.error('Erro na busca híbrida:', error);
      return [];
    }

    console.log(`🔎 Híbrido → ${candidatos?.length || 0} candidatos`);
    return candidatos || [];
    
  } catch (error) {
    console.error('Erro ao buscar documentos relacionados:', error);
    return [];
  }
}

/**
 * Re-ranking dos documentos usando LLM
 */
export async function rerankComLLM(docs: any[], pergunta: string) {
  if (!docs || docs.length === 0) return [];

  try {
    console.log('🧠 Re-ranking com LLM...');
    
    const docsParaAnalise = docs.map((doc, idx) => 
      `ID: ${doc.id}\nTítulo: ${doc.titulo}\nConteúdo: ${JSON.stringify(doc.conteudo).substring(0, 800)}`
    ).join('\n\n---\n\n');

    const prompt = `Você deve analisar os documentos e classificar sua relevância para responder à pergunta do usuário.

PERGUNTA: "${pergunta}"

DOCUMENTOS:
${docsParaAnalise}

Retorne APENAS um JSON válido com array "scores" contendo objetos com "id" e "score" (0-100):
{"scores": [{"id": "doc-id", "score": 85}, ...]}

Critérios:
- Score 80-100: Diretamente relevante e útil
- Score 60-79: Parcialmente relevante  
- Score 40-59: Tangencialmente relacionado
- Score 0-39: Pouco ou nada relevante`;

    const response = await openAI('chat/completions', {
      model: 'gpt-4.1-2025-04-14',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    if (!response.ok) {
      throw new Error(`LLM rerank error: ${await response.text()}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    console.log(`LLM rerank parsed items: ${result.scores?.length || 0}`);
    
    if (!result.scores) return docs.slice(0, 5);

    // Ordenar por score e pegar top 5
    const rankedDocs = result.scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => docs.find(doc => doc.id === item.id))
      .filter(Boolean);

    return rankedDocs;
    
  } catch (error) {
    console.error('Erro no reranking LLM:', error);
    return docs.slice(0, 5);
  }
}

/**
 * Gera resposta final usando contexto dos documentos - adaptado do Z-API WhatsApp
 */
export async function gerarRespostaComContexto(docs: any[], pergunta: string, ticketConversa?: any[]) {
  try {
    const contexto = docs.map(doc => 
      `**${doc.titulo}**\n${JSON.stringify(doc.conteudo)}`
    ).join('\n\n');

    // Formatar histórico da conversa do ticket (últimas 5 mensagens para contexto)
    let historicoConversa = '';
    if (ticketConversa && ticketConversa.length > 0) {
      const ultimasMensagens = ticketConversa.slice(-5);
      historicoConversa = ultimasMensagens.map((msg: any) => {
        const autor = msg.autor || 'Sistema';
        return `${autor}: ${msg.texto}`;
      }).join('\n');
    }

    // Buscar prompt configurável da tabela faq_ai_settings
    const { data: settingsData } = await supabase
      .from('faq_ai_settings')
      .select('prompt_sugestao')
      .eq('ativo', true)
      .single();

    const systemMessage = settingsData?.prompt_sugestao || `Você é um assistente especializado em suporte técnico da Cresci & Perdi! 🎯

REGRA PRINCIPAL: SEJA OBJETIVO E ÚTIL
- Responda diretamente à pergunta do ticket
- Use informações relevantes da base de conhecimento
- Mantenha tom profissional mas amigável
- Estruture respostas de forma clara

FORMATAÇÃO:
- Use emojis para organizar visualmente
- Separe ideias em parágrafos
- Destaque pontos importantes

INSTRUÇÕES:
- Use APENAS informações da base de conhecimento fornecida
- Se não encontrar informações suficientes, seja honesto
- Adapte a resposta ao contexto do ticket
- Seja conciso mas completo`;

    const userMessage = `TICKET: ${pergunta}

${historicoConversa ? `HISTÓRICO DA CONVERSA:
${historicoConversa}

` : ''}CONTEXTO DA BASE DE CONHECIMENTO:
${contexto}

Gere uma sugestão de resposta profissional baseada nas informações da base de conhecimento.`;

    const response = await openAI('chat/completions', {
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      max_completion_tokens: 1000
    });

    if (!response.ok) {
      throw new Error(`Response generation error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('Erro na geração de resposta:', error);
    return "Não encontrei informações suficientes na base de conhecimento para gerar uma sugestão adequada para este ticket.";
  }
}