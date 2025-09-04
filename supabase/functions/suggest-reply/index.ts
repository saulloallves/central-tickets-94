
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

/**
 * Encontra documentos relacionados usando busca vetorial semântica
 * @param {string} textoDeBusca - Texto do ticket para buscar conhecimento
 * @returns {Array} - Lista de documentos relevantes
 */
async function encontrarDocumentosRelacionados(textoDeBusca) {
  console.log("1. Gerando embedding para o texto do ticket...");
  
  // 1. Gera o vetor para o texto de busca usando text-embedding-3-small
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // Modelo atualizado 1536 dimensões
      input: textoDeBusca,
    }),
  });

  if (!embeddingResponse.ok) {
    const error = await embeddingResponse.text();
    console.error("❌ Erro ao gerar embedding:", error);
    return [];
  }

  const embeddingData = await embeddingResponse.json();
  const queryEmbedding = embeddingData.data[0].embedding;

  // 2. Configura busca híbrida com thresholds otimizados
  const LIMIAR_DE_RELEVANCIA = 0.6; // Threshold mais alto para menos ruído
  const MAXIMO_DE_DOCUMENTOS = 5; // Menos documentos, mais focados

  console.log("2. Executando busca híbrida (semântica + text search)...");
  console.log("Parâmetros da busca:", {
    threshold: LIMIAR_DE_RELEVANCIA,
    max_docs: MAXIMO_DE_DOCUMENTOS,
    embedding_size: queryEmbedding.length
  });
  
  // 3. Chama a função híbrida no Supabase
  const { data, error } = await supabase.rpc('match_documentos_hibrido', {
    query_embedding: queryEmbedding,
    query_text: textoDeBusca,
    match_count: MAXIMO_DE_DOCUMENTOS,
    alpha: 0.65
  });

  if (error) {
    console.error("❌ Erro na busca híbrida de documentos:", error);
    return [];
  }

  // Filtrar por score híbrido
  const documentosRelevantes = (data || []).filter(doc => doc.score >= LIMIAR_DE_RELEVANCIA);

  console.log(`✅ Busca executada com sucesso. Resultados: ${documentosRelevantes.length} documentos relevantes`);
  if (documentosRelevantes && documentosRelevantes.length > 0) {
    console.log("📄 Documentos encontrados:");
    documentosRelevantes.forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.titulo} (v${doc.versao}) - score: ${(doc.score * 100).toFixed(1)}% (sem: ${(doc.similaridade * 100).toFixed(1)}%, text: ${(doc.text_rank * 100).toFixed(1)}%)`);
    });
  } else {
    console.log("⚠️ NENHUM documento encontrado com score >=", LIMIAR_DE_RELEVANCIA);
  }
  
  return documentosRelevantes;
}

/**
 * Gera resposta com contexto usando GPT-4o
 * @param {string} contexto - Contexto formatado dos documentos
 * @param {string} perguntaOriginal - Pergunta/problema do ticket
 * @returns {string} - Sugestão de resposta gerada
 */
// Formatar contexto com fontes estruturadas
function formatarContextoFontes(docs) {
  return docs.map((doc, i) =>
    `[Fonte ${i+1}] "${doc.titulo}" (v${doc.versao}) — ${doc.categoria}\n` +
    `${(doc.conteudo || '').replace(/\s+/g,' ').slice(0,700)}\n` +
    `ID:${doc.id}`
  ).join('\n\n');
}

async function gerarRespostaComContexto(docsSelecionados, perguntaOriginal) {
  console.log("3. Gerando sugestão de resposta com GPT-4o...");
  
  const contexto = formatarContextoFontes(docsSelecionados);
  
  const systemMsg = `Você é o Girabot, assistente da Cresci e Perdi.
Regras: responda SÓ com base no CONTEXTO. Máx. 3 frases, diretas. Se não houver dado suficiente, diga exatamente:
"Não encontrei informações suficientes na base de conhecimento para responder essa pergunta específica".
Retorne no final as fontes usadas no formato [Fonte N].`;

  const userMsg = `CONTEXTO:
${contexto}

PERGUNTA:
${perguntaOriginal}

Responda em até 3 frases e cite as fontes no formato [Fonte N].`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.1, // Temperatura baixa para ser factual
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GPT-4o API error: ${errorText}`);
  }

  const apiData = await response.json();
  return apiData.choices[0].message.content;
}

/**
 * Orquestra todo o processo de geração de sugestão de resposta para um ticket.
 * @param {object} ticket - Objeto contendo { titulo: string, descricao_problema: string }
 * @returns {string} - A sugestão de resposta gerada pela IA.
 */
async function obterSugestaoDeRespostaParaTicket(ticket) {
  const textoDoTicket = `Título: ${ticket.titulo || ticket.codigo_ticket}\nDescrição: ${ticket.descricao_problema}`;
  
  console.log("1. Buscando conhecimento relevante na base...");
  // Etapa de Busca (Retrieval)
  const documentosDeContexto = await encontrarDocumentosRelacionados(textoDoTicket);

  if (!documentosDeContexto || documentosDeContexto.length === 0) {
    return {
      resposta: "Não encontrei informações na base de conhecimento para responder essa pergunta.",
      metrics: {
        documentos_encontrados: 0,
        relevancia_media: '0%',
        relevancia_maxima: '0%'
      }
    };
  }

  console.log(`2. Encontrados ${documentosDeContexto.length} documentos. Gerando resposta...`);
  
  // Calcular métricas de relevância usando scores híbridos
  const scores = documentosDeContexto.map(doc => doc.score || doc.similaridade || 0);
  const relevanciaMedia = scores.reduce((sum, val) => sum + val, 0) / scores.length;
  const relevanciaMaxima = Math.max(...scores);
  
  // Debug: Mostrar quais documentos foram encontrados
  console.log("Documentos encontrados:");
  documentosDeContexto.forEach((doc, index) => {
    const score = doc.score || doc.similaridade || 0;
    console.log(`  ${index + 1}. ${doc.titulo} (v${doc.versao}) - Score: ${(score * 100).toFixed(1)}%`);
  });

  console.log("3. Gerando sugestão de resposta com GPT-4o...");
  // Etapa de Geração (Generation) usando documentos estruturados
  const sugestaoFinal = await gerarRespostaComContexto(documentosDeContexto, textoDoTicket);

  console.log("4. Sugestão gerada com sucesso!");
  return {
    resposta: sugestaoFinal,
    metrics: {
      documentos_encontrados: documentosDeContexto.length,
      relevancia_media: `${(relevanciaMedia * 100).toFixed(1)}%`,
      relevancia_maxima: `${(relevanciaMaxima * 100).toFixed(1)}%`
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Recebendo requisição...');
    
    // Parse JSON com tratamento de erro
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📋 Request body parsed:', requestBody);
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { ticketId } = requestBody;
    
    if (!ticketId) {
      console.error('❌ ticketId não fornecido');
      throw new Error('ticketId is required');
    }

    console.log('=== INICIANDO GERAÇÃO DE SUGESTÃO RAG ===');
    console.log('🎫 Ticket ID:', ticketId);

    // Verificar se as variáveis de ambiente estão corretas
    if (!openAIApiKey) {
      console.error('❌ OPENAI_API_KEY não configurada');
      throw new Error('OpenAI API key not configured');
    }
    console.log('✅ OpenAI API key configurada');

    // 1. Buscar dados do ticket com tratamento de erro mais detalhado
    console.log('🔍 Buscando dados do ticket...');
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        id,
        codigo_ticket,
        titulo,
        descricao_problema,
        categoria,
        prioridade,
        unidade_id
      `)
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketError) {
      console.error('❌ Erro na query do ticket:', ticketError);
      throw new Error(`Erro ao buscar ticket: ${ticketError.message}`);
    }

    if (!ticket) {
      console.error('❌ Ticket não encontrado');
      throw new Error('Ticket not found');
    }

    console.log('✅ Ticket encontrado:', ticket.codigo_ticket);
    console.log('📝 Dados do ticket:', {
      titulo: ticket.titulo,
      categoria: ticket.categoria,
      descricao_length: ticket.descricao_problema?.length || 0
    });

    // 2. Executar o pipeline RAG principal usando as funções documentadas
    console.log('🤖 Iniciando pipeline RAG...');
    let resultadoRAG;
    try {
      resultadoRAG = await obterSugestaoDeRespostaParaTicket(ticket);
      console.log('✅ Pipeline RAG concluído');
    } catch (ragError) {
      console.error('❌ Erro no pipeline RAG:', ragError);
      throw new Error(`Erro no pipeline RAG: ${ragError.message}`);
    }

    // 3. Salvar a interação no banco para análise
    console.log('💾 Salvando interação no banco...');
    const { data: suggestionRecord, error: saveError } = await supabase
      .from('ticket_ai_interactions')
      .insert({
        ticket_id: ticketId,
        kind: 'suggestion',
        resposta: resultadoRAG.resposta,
        model: 'gpt-4o',
        params: {
          temperature: 0.2,
          max_tokens: 1000
        },
        log: {
          rag_pipeline: 'v4_hibrido',
          embedding_model: 'text-embedding-3-small',
          pipeline_version: 'RAG_v4_Hibrido_Otimizado',
          metrics: resultadoRAG.metrics
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('⚠️ Erro ao salvar sugestão (não crítico):', saveError);
      // Não falha aqui, só registra o erro
    } else {
      console.log('✅ Interação salva no banco');
    }

    console.log('🎉 === SUGESTÃO GERADA COM SUCESSO ===');

    const response = {
      resposta: resultadoRAG.resposta,
      rag_metrics: {
        pipeline_version: 'RAG_v4_Hibrido_Otimizado',
        modelo_embedding: 'text-embedding-3-small',
        modelo_geracao: 'gpt-4o',
        documentos_encontrados: resultadoRAG.metrics.documentos_encontrados,
        relevancia_media: resultadoRAG.metrics.relevancia_media,
        relevancia_maxima: resultadoRAG.metrics.relevancia_maxima
      }
    };

    console.log('📤 Enviando resposta de sucesso');
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 ERRO FATAL na função suggest-reply:', error);
    console.error('Stack trace:', error.stack);
    
    const errorResponse = { 
      error: error.message,
      details: error.stack
    };
    
    console.log('📤 Enviando resposta de erro');
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
