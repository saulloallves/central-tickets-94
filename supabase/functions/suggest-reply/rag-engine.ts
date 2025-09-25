import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { openAI } from './openai-client.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Recupera documentos relacionados usando busca híbrida (semântica + keyword)
 * Adaptado da tecnologia Z-API WhatsApp
 */
export async function encontrarDocumentosRelacionados(textoTicket: string, limiteResultados: number = 10) {
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

    console.log('🔎 Executando busca híbrida otimizada...');
    
    const { data: candidatos, error } = await supabase.rpc('match_documentos_hibrido', {
      query_embedding: queryEmbedding,
      query_text: textoTicket,
      match_count: limiteResultados,
      alpha: 0.7 // Prioriza busca semântica
    });

    if (error) {
      console.error('Erro na busca híbrida:', error);
      return [];
    }

    // Filtrar candidatos com similaridade mínima
    const candidatosFiltrados = (candidatos || []).filter(doc => {
      const similarity = doc.similarity || 0;
      return similarity > 0.4;
    });

    console.log(`🔎 Híbrido → ${candidatos?.length || 0} candidatos iniciais, ${candidatosFiltrados.length} após filtro de similaridade`);
    return candidatosFiltrados;
    
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
    
    if (!result.scores) return [];

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
    return [];
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

    const systemMessage = settingsData?.prompt_sugestao || `Você é um assistente especializado em suporte técnico da Cresci & Perdi (brechó/marketplace de roupas usadas)! 🎯

REGRA PRINCIPAL: SEJA OBJETIVO E ESPECÍFICO DA CRESCI & PERDI
- Responda APENAS sobre assuntos relacionados ao negócio da Cresci & Perdi
- Use informações relevantes da base de conhecimento (score ≥ 70)
- Mantenha tom profissional mas amigável
- Estruture respostas de forma clara

VALIDAÇÃO RIGOROSA DE RELEVÂNCIA:
- Se os documentos encontrados têm baixa relevância (< 70), informe que não há informações suficientes
- REJEITE responder sobre outros negócios ou temas não relacionados
- APENAS temas sobre: brechó, roupas usadas, compra/venda, avaliação, plataforma, atendimento

FORMATAÇÃO:
- Use emojis para organizar visualmente
- Separe ideias em parágrafos
- Destaque pontos importantes

INSTRUÇÕES:
- Use APENAS informações da base de conhecimento fornecida
- Se não encontrar informações suficientes ou relevantes, seja honesto
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