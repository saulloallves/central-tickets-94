import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { openAI } from './openai-client.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Recupera documentos relacionados usando busca híbrida (semântica + keyword)
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
 * Gera resposta final usando contexto dos documentos
 */
export async function gerarRespostaComContexto(docs: any[], pergunta: string) {
  try {
    const contexto = docs.map(doc => 
      `**${doc.titulo}**\n${JSON.stringify(doc.conteudo)}`
    ).join('\n\n');

    const systemMessage = `Você é um assistente virtual amigável da Cresci & Perdi! 😊

REGRA PRINCIPAL: SEJA OBJETIVO
- Vá direto ao ponto
- Apenas detalhe mais se for necessário para esclarecer melhor
- Priorize clareza e simplicidade

FORMATAÇÃO OBRIGATÓRIA - MUITO IMPORTANTE:
- SEMPRE use \n (quebra de linha) entre cada parágrafo
- Inicie cada parágrafo com um emoji relacionado ao assunto
- Cada ideia deve estar em uma linha separada
- NUNCA escreva tudo numa linha só

EXEMPLO DE FORMATAÇÃO CORRETA COM \n:
"👕 Para lançar calças no sistema, siga os níveis.\n\n🔢 Nível 1: Roupa bebê → Nível 2: Calça → Nível 3: Tipo → Nível 4: Condição.\n\n✅ Depois é só seguir a avaliação normal.\n\n🤝 Dúvidas?"

DICAS DE EMOJIS:
- Roupas: 👕👖👗 | Sistema: 💻📱⚙️ | Processo: 🔄⚡📋 | Ajuda: 🤝💬❓

INSTRUÇÕES:
- Use apenas informações da base de conhecimento
- SEMPRE use \n entre parágrafos para separar as linhas
- Seja objetivo, só detalhe se necessário
- Responda APENAS com o texto final, sem JSON ou formatação extra`;

    const userMessage = `PERGUNTA: ${pergunta}

CONTEXTO:
${contexto}

Responda com base apenas nas informações do contexto.`;

    const response = await openAI('chat/completions', {
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      max_completion_tokens: 150
    });

    if (!response.ok) {
      throw new Error(`Response generation error: ${await response.text()}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('Erro na geração de resposta:', error);
    return "❓ Não encontrei informações suficientes na base de conhecimento para responder sua pergunta.\n\n🤝 Por favor, reformule ou fale com nosso suporte.";
  }
}