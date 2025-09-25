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
 * Re-ranking dos documentos usando LLM otimizado para Cresci & Perdi
 */
export async function rerankComLLM(docs: any[], pergunta: string) {
  if (!docs || docs.length === 0) return [];

  try {
    console.log('🧠 Re-ranking com LLM otimizado...');
    
    const docsParaAnalise = docs.map((doc, idx) => 
      `ID: ${doc.id}\nTítulo: ${doc.titulo}\nCategoria: ${doc.categoria || 'N/A'}\nConteúdo: ${JSON.stringify(doc.conteudo).substring(0, 800)}`
    ).join('\n\n---\n\n');

    const prompt = `Você é um especialista em atendimento da Cresci & Perdi. Analise os documentos e classifique sua relevância para responder à pergunta específica do cliente/atendente.

CONTEXTO: A Cresci & Perdi é uma empresa de brechó/marketplace de roupas usadas. Os documentos devem ser relevantes para:
- Processos de venda, compra, avaliação de roupas
- Funcionamento da plataforma/sistema
- Políticas comerciais e operacionais
- Suporte técnico e atendimento

PERGUNTA/PROBLEMA: "${pergunta}"

DOCUMENTOS DA BASE DE CONHECIMENTO:
${docsParaAnalise}

CRITÉRIOS DE AVALIAÇÃO RIGOROSOS:
- Score 90-100: Responde DIRETAMENTE ao problema/pergunta específica da Cresci & Perdi
- Score 70-89: Contém informações relevantes que ajudam a resolver o problema
- Score 50-69: Relacionado ao tema mas não resolve diretamente o problema
- Score 30-49: Tangencialmente relacionado ao negócio da Cresci & Perdi
- Score 0-29: Irrelevante ou sobre outro assunto completamente

PENALIZAÇÕES:
- Documentos sobre outros negócios/empresas: -50 pontos
- Informações genéricas não específicas da Cresci & Perdi: -30 pontos
- Conteúdo obsoleto ou contraditório: -40 pontos

Retorne APENAS um JSON válido:
{"scores": [{"id": "doc-id", "score": 85}, ...]}`;

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

    // Filtro rigoroso: apenas scores >= 70
    const docsRelevantes = result.scores
      .filter(item => item.score >= 70)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) // Máximo 3 documentos mais relevantes
      .map(item => {
        const doc = docs.find(d => d.id === item.id);
        if (doc) {
          doc.relevance_score = item.score;
        }
        return doc;
      })
      .filter(Boolean);

    console.log(`🎯 RAG v4 - Documentos selecionados (score ≥ 70): ${docsRelevantes.length}`);
    docsRelevantes.forEach(doc => {
      console.log(`   📄 ${doc.titulo} (Score: ${doc.relevance_score})`);
    });

    return docsRelevantes;
    
  } catch (error) {
    console.error('Erro no reranking LLM:', error);
    return docs.slice(0, 5);
  }
}

/**
 * Gera resposta final usando contexto dos documentos e histórico da conversa
 */
export async function gerarRespostaComContexto(docs: any[], pergunta: string, conversationHistory?: any[], contactPhone?: string) {
  try {
    const contexto = docs.map(doc => 
      `**${doc.titulo}**\n${JSON.stringify(doc.conteudo)}`
    ).join('\n\n');

    // Buscar histórico da conversa se fornecido o contactPhone (apenas últimas 5 mensagens para otimizar)
    let conversaCompleta = conversationHistory;
    if (!conversaCompleta && contactPhone) {
      const { data: conversaData } = await supabase
        .from('whatsapp_conversas')
        .select('conversa')
        .eq('contact_phone', contactPhone)
        .single();
      
      conversaCompleta = conversaData?.conversa || [];
    }

    // Formatar histórico da conversa (apenas últimas 5 mensagens para evitar overhead)
    let historicoConversa = '';
    if (conversaCompleta && conversaCompleta.length > 0) {
      const ultimasMensagens = conversaCompleta.slice(-5);
      historicoConversa = ultimasMensagens.map((msg: any) => {
        const autor = msg.from_me ? 'Suporte' : 'Cliente';
        return `${autor}: ${msg.text}`;
      }).join('\n');
    }

    // Buscar prompt configurável da tabela faq_ai_settings
    const { data: settingsData } = await supabase
      .from('faq_ai_settings')
      .select('prompt_zapi_whatsapp')
      .eq('ativo', true)
      .single();

    const systemMessage = settingsData?.prompt_zapi_whatsapp || `Você é um assistente virtual amigável da Cresci & Perdi (brechó/marketplace de roupas usadas)! 😊

VALIDAÇÃO RIGOROSA DE RELEVÂNCIA:
- Use APENAS informações da base de conhecimento da Cresci & Perdi (score ≥ 70)
- REJEITE perguntas sobre outros negócios ou temas não relacionados
- APENAS temas sobre: brechó, roupas usadas, compra/venda, avaliação, plataforma, atendimento

REGRA PRINCIPAL: SEJA OBJETIVO E ESPECÍFICO
- Vá direto ao ponto sobre questões da Cresci & Perdi
- Se não há informações relevantes (score < 70), seja honesto
- Se pergunta for sobre outro negócio, informe que só pode ajudar com a Cresci & Perdi

FORMATAÇÃO OBRIGATÓRIA - MUITO IMPORTANTE:
- SEMPRE use \\n (quebra de linha) entre cada parágrafo
- Inicie cada parágrafo com um emoji relacionado ao assunto
- Cada ideia deve estar em uma linha separada
- NUNCA escreva tudo numa linha só

EXEMPLO DE FORMATAÇÃO CORRETA COM \\n:
"👕 Para lançar calças no sistema, siga os níveis.\\n\\n🔢 Nível 1: Roupa bebê → Nível 2: Calça → Nível 3: Tipo → Nível 4: Condição.\\n\\n✅ Depois é só seguir a avaliação normal.\\n\\n🤝 Dúvidas?"

DICAS DE EMOJIS:
- Roupas: 👕👖👗 | Sistema: 💻📱⚙️ | Processo: 🔄⚡📋 | Ajuda: 🤝💬❓

INSTRUÇÕES:
- Use apenas informações relevantes da base de conhecimento (score ≥ 70)
- SEMPRE use \\n entre parágrafos para separar as linhas
- Seja objetivo, só detalhe se necessário
- Responda APENAS com o texto final, sem JSON ou formatação extra`;

    const userMessage = `PERGUNTA ATUAL: ${pergunta}

${historicoConversa ? `HISTÓRICO DA CONVERSA:
${historicoConversa}

` : ''}CONTEXTO DA BASE DE CONHECIMENTO:
${contexto}

Responda com base nas informações do contexto, considerando o histórico da conversa para dar uma resposta mais personalizada e contextualizada.`;

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
    return "❓ Não encontrei informações suficientes na base de conhecimento para responder sua pergunta.\\n\\n🤝 Por favor, reformule ou fale com nosso suporte.";
  }
}