
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
  
  // 1. Gera o vetor para o texto de busca (o ticket)
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-large',
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

  // 2. Configura a busca para ser abrangente
  const LIMIAR_DE_RELEVANCIA = 0.75; // Threshold padrão mais rigoroso
  const MAXIMO_DE_DOCUMENTOS = 5;

  console.log("2. Executando busca semântica na base de conhecimento...");
  console.log("Parâmetros da busca:", {
    threshold: LIMIAR_DE_RELEVANCIA,
    max_docs: MAXIMO_DE_DOCUMENTOS,
    embedding_size: queryEmbedding.length
  });
  
  // 3. Chama a função segura no Supabase
  const { data, error } = await supabase.rpc('match_documentos', {
    query_embedding: queryEmbedding,
    match_threshold: LIMIAR_DE_RELEVANCIA,
    match_count: MAXIMO_DE_DOCUMENTOS
  });

  if (error) {
    console.error("❌ ERRO na função RPC match_documentos:", error);
    console.error("Detalhes completos do erro:", JSON.stringify(error, null, 2));
    return []; // Retorna array vazio em vez de throw
  }

  console.log(`✅ Busca RPC executada com sucesso. Resultados: ${data?.length || 0} documentos`);
  if (data && data.length > 0) {
    console.log("📄 Documentos encontrados:");
    data.forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.titulo} (v${doc.versao}) - similaridade: ${(doc.similaridade * 100).toFixed(1)}%`);
    });
  } else {
    console.log("⚠️ NENHUM documento encontrado com threshold", LIMIAR_DE_RELEVANCIA);
  }
  
  return data || [];
}

/**
 * Gera resposta com contexto usando GPT-4o
 * @param {string} contexto - Contexto formatado dos documentos
 * @param {string} perguntaOriginal - Pergunta/problema do ticket
 * @returns {string} - Sugestão de resposta gerada
 */
async function gerarRespostaComContexto(contexto, perguntaOriginal) {
  console.log("3. Gerando sugestão de resposta com GPT-4o...");
  
  const promptParaIA = `
  Você é um assistente especialista e sua única função é gerar sugestões de respostas para tickets de suporte.

  **REGRAS CRÍTICAS:**
  1.  Use EXCLUSIVAMENTE as informações fornecidas na seção "CONTEXTO" abaixo para formular sua resposta.
  2.  NÃO invente, assuma ou adicione qualquer informação que não esteja explicitamente no contexto.
  3.  Responda diretamente à pergunta do usuário, que está na seção "PERGUNTA ORIGINAL".
  4.  Adote um tom profissional, claro e prestativo.
  5.  Ao final da sua resposta, cite as fontes que você usou no formato: [Fonte: Título do Artigo, Versão X].

  ---
  **CONTEXTO (Fonte da Verdade):**
  ${contexto}
  ---
  **PERGUNTA ORIGINAL DO TICKET:**
  ${perguntaOriginal}
  ---

  **SUGESTÃO DE RESPOSTA:**
  `;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: promptParaIA }
      ],
      temperature: 0.2, // Temperatura muito baixa para ser factual e evitar criatividade
      max_tokens: 1000,
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
 * @param {object} ticket - Objeto contendo { titulo: string, descricao: string }
 * @returns {string} - A sugestão de resposta gerada pela IA.
 */
async function obterSugestaoDeRespostaParaTicket(ticket) {
  const textoDoTicket = `Título: ${ticket.titulo || ticket.codigo_ticket}\nDescrição: ${ticket.descricao_problema}`;
  
  console.log("1. Buscando conhecimento relevante na base...");
  // Etapa de Busca (Retrieval)
  const documentosDeContexto = await encontrarDocumentosRelacionados(textoDoTicket);

  if (!documentosDeContexto || documentosDeContexto.length === 0) {
    return "Não foi encontrado nenhum artigo na base de conhecimento que possa ajudar a responder este ticket.";
  }

  console.log(`2. Encontrados ${documentosDeContexto.length} documentos. Formatando contexto...`);
  
  // Debug: Mostrar quais documentos foram encontrados
  console.log("Documentos encontrados:");
  documentosDeContexto.forEach((doc, index) => {
    console.log(`  ${index + 1}. ${doc.titulo} (v${doc.versao}) - Categoria: ${doc.categoria}`);
  });
  
  // Formata o contexto para ser injetado no prompt
  const contextoFormatado = documentosDeContexto.map((doc, index) =>
    `--- Início da Fonte ${index + 1} ---\n` +
    `Título: "${doc.titulo}" (Versão ${doc.versao})\n` +
    `Conteúdo: ${JSON.stringify(doc.conteudo)}\n` +
    `--- Fim da Fonte ${index + 1} ---`
  ).join('\n\n');

  console.log("3. Gerando sugestão de resposta com GPT-4o...");
  // Etapa de Geração (Generation)
  const sugestaoFinal = await gerarRespostaComContexto(contextoFormatado, textoDoTicket);

  console.log("4. Sugestão gerada com sucesso!");
  return sugestaoFinal;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId } = await req.json();
    
    if (!ticketId) {
      throw new Error('ticketId is required');
    }

    console.log('=== INICIANDO GERAÇÃO DE SUGESTÃO RAG ===');
    console.log('Ticket ID:', ticketId);

    // 1. Buscar dados do ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades(id, grupo),
        colaboradores(nome_completo, email)
      `)
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketError || !ticket) {
      console.error('Error fetching ticket:', ticketError);
      throw new Error('Ticket not found');
    }

    console.log('Ticket encontrado:', ticket.codigo_ticket);

    // 2. Executar o pipeline RAG principal usando as funções documentadas
    const sugestaoGerada = await obterSugestaoDeRespostaParaTicket(ticket);

    // 3. Salvar a interação no banco para análise
    const { data: suggestionRecord, error: saveError } = await supabase
      .from('ticket_ai_interactions')
      .insert({
        ticket_id: ticketId,
        kind: 'suggestion',
        resposta: sugestaoGerada,
        model: 'gpt-4o',
        params: {
          temperature: 0.2,
          max_tokens: 1000
        },
        log: {
          rag_pipeline: 'v3_documentado',
          embedding_model: 'text-embedding-3-large',
          pipeline_version: 'RAG_v3_Estruturado'
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving suggestion:', saveError);
      // Não falha aqui, só registra o erro
    }

    console.log('=== SUGESTÃO GERADA COM SUCESSO ===');

    return new Response(JSON.stringify({
      resposta: sugestaoGerada,
      rag_metrics: {
        pipeline_version: 'RAG_v3_Estruturado',
        modelo_embedding: 'text-embedding-3-large',
        modelo_geracao: 'gpt-4o'
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
