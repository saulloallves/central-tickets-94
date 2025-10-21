import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

async function openAI(path: string, payload: any, tries = 3) {
  let wait = 300;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) return r;
    if (r.status === 429 || r.status === 503) { 
      await new Promise(res => setTimeout(res, wait)); 
      wait *= 2; 
      continue; 
    }
    throw new Error(`${path} error: ${await r.text()}`);
  }
  throw new Error(`${path} error: too many retries`);
}

/**
 * RAG v4 - Busca híbrida otimizada usando embeddings + keywords
 */
async function encontrarDocumentosRelacionados(textoMensagem: string, limiteResultados: number = 10) {
  try {
    console.log('🔍 Gerando embedding para:', textoMensagem.substring(0, 100) + '...');
    
    const embeddingResponse = await openAI('embeddings', {
      model: 'text-embedding-3-small',
      input: textoMensagem
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Embedding API error: ${await embeddingResponse.text()}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('🔎 Executando busca híbrida v4 otimizada...');
    
    const { data: candidatos, error } = await supabase.rpc('match_documentos_hibrido', {
      query_embedding: queryEmbedding,
      query_text: textoMensagem,
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
      return similarity > 0.4; // Filtro de similaridade mínima
    });

    console.log(`🔎 RAG v4 → ${candidatos?.length || 0} candidatos iniciais, ${candidatosFiltrados.length} após filtro de similaridade`);
    return candidatosFiltrados;
    
  } catch (error) {
    console.error('Erro ao buscar documentos relacionados:', error);
    return [];
  }
}

/**
 * RAG v4 - Re-ranking com LLM otimizado para Cresci & Perdi
 */
async function rerankComLLM(docs: any[], pergunta: string) {
  if (!docs || docs.length === 0) return [];

  try {
    console.log('🧠 Re-ranking com LLM v4 otimizado...');
    
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
    
    console.log(`RAG v4 rerank parsed items: ${result.scores?.length || 0}`);
    
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
 * Correção da resposta usando RAG v4 + GPT-4.1
 */
async function corrigirRespostaComRAGv4(mensagem: string, documentos: any[]) {
  if (!openaiApiKey) {
    console.log('⚠️ OpenAI API key não configurada, retornando mensagem original');
    return mensagem;
  }

  try {
    // Buscar configurações de IA para obter o prompt customizável
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: aiSettings, error: settingsError } = await supabase
      .from('faq_ai_settings')
      .select('prompt_format_response, usar_base_conhecimento_formatacao')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('❌ Erro ao buscar configurações de IA:', settingsError);
    }

    const usarBaseConhecimento = aiSettings?.usar_base_conhecimento_formatacao ?? true;
    
    console.log('🔧 Configurações carregadas:', { 
      temPromptCustomizado: !!aiSettings?.prompt_format_response,
      promptLength: aiSettings?.prompt_format_response?.length || 0,
      usarBaseConhecimento,
      promptPreview: aiSettings?.prompt_format_response?.substring(0, 150) || 'SEM PROMPT PERSONALIZADO'
    });

    // Se não usar base de conhecimento, fazer apenas correção gramatical
    if (!usarBaseConhecimento) {
      console.log('📝 Modo: Apenas correção gramatical (sem RAG)');
      console.log('🎯 Prompt que será usado:', aiSettings?.prompt_format_response ? 'PROMPT PERSONALIZADO' : 'PROMPT PADRÃO');
      return await corrigirApenasGramatica(mensagem, aiSettings?.prompt_format_response);
    }

    const contexto = documentos.map(doc => 
      `**${doc.titulo}**\n${JSON.stringify(doc.conteudo)}`
    ).join('\n\n');

    console.log(`🧠 RAG v4 - Usando GPT-4.1 com ${documentos.length} documentos de contexto`);

    // Validação final: verificar se há informações realmente relevantes
    if (documentos.length === 0) {
      console.log('⚠️ Nenhum documento relevante encontrado, usando apenas correção gramatical');
      return await corrigirApenasGramatica(mensagem, aiSettings?.prompt_format_response);
    }

    // Verificar se os documentos têm score de relevância alto o suficiente
    const docsComScoreAlto = documentos.filter(doc => (doc.relevance_score || 0) >= 70);
    if (docsComScoreAlto.length === 0) {
      console.log('⚠️ Documentos com baixa relevância (< 70), usando apenas correção gramatical');
      return await corrigirApenasGramatica(mensagem, aiSettings?.prompt_format_response);
    }

    // Usar prompt configurável ou fallback para o padrão
    const customPrompt = aiSettings?.prompt_format_response;
    const defaultPrompt = `Você é um especialista em atendimento ao cliente da Cresci & Perdi (brechó/marketplace de roupas usadas).

IMPORTANTE: Você deve corrigir e padronizar a resposta do atendente seguindo estas regras:

🔧 CORREÇÃO E PADRONIZAÇÃO:
1. Corrija português (ortografia, gramática, concordância)
2. Use tom educado, profissional e acolhedor específico da Cresci & Perdi
3. Mantenha o conteúdo essencial da resposta
4. Torne a resposta mais clara, completa e detalhada
5. Use linguagem institucional consistente com o negócio de brechó

📚 VALIDAÇÃO RIGOROSA COM BASE DE CONHECIMENTO (RAG v4):
- APENAS use informações da base de conhecimento da Cresci & Perdi fornecida
- Se a resposta do atendente contradizer a base oficial, SEMPRE corrija usando as informações oficiais
- Se não há informações relevantes suficientes na base (score < 70), indique que precisa consultar supervisão
- NUNCA invente informações sobre políticas, preços, processos que não estão documentados
- NUNCA cite códigos de manuais ou documentos específicos
- REJEITE responder sobre assuntos não relacionados ao negócio da Cresci & Perdi
- Se a pergunta for sobre outro negócio/empresa, indique que só pode ajudar com questões da Cresci & Perdi

🚫 FILTROS DE ASSUNTO:
- APENAS temas relacionados a: brechó, roupas usadas, compra/venda, avaliação, plataforma, atendimento
- REJEITE: outros negócios, temas não relacionados, informações genéricas

📋 FORMATO DE SAÍDA:
CRÍTICO: Retorne APENAS a versão corrigida e padronizada da resposta PRONTA PARA ENVIAR AO CLIENTE.
NÃO inclua frases como "Claro! Aqui está a resposta formatada..." ou "Segue a resposta corrigida...".
Retorne DIRETAMENTE a resposta formatada, sem introduções ou explicações sobre o processo.`;

    console.log(`🎯 Usando prompt ${customPrompt ? 'personalizado' : 'padrão'} para formatação`);

    const response = await openAI('chat/completions', {
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: customPrompt || defaultPrompt
        },
        {
          role: 'user',
          content: `BASE DE CONHECIMENTO (RAG v4):
${contexto}

RESPOSTA DO ATENDENTE PARA CORRIGIR:
${mensagem}

Corrija e padronize esta resposta usando as informações da base de conhecimento quando relevante:`
        }
      ],
      max_completion_tokens: 1000
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Erro ao corrigir resposta:', error);
    return mensagem; // Retorna original em caso de erro
  }
}

/**
 * Correção apenas gramatical (sem base de conhecimento)
 */
async function corrigirApenasGramatica(mensagem: string, customPrompt?: string) {
  if (!openaiApiKey) {
    console.log('⚠️ OpenAI API key não configurada, retornando mensagem original');
    return mensagem;
  }

  try {
    console.log('✏️ Corrigindo apenas gramática e formatação');
    console.log('🎯 Prompt recebido:', customPrompt ? 'PERSONALIZADO (' + customPrompt.length + ' chars)' : 'PADRÃO');

    const defaultGrammarPrompt = `Você é um assistente especializado em correção de textos para atendimento ao cliente.

OBJETIVO: Corrigir APENAS gramática, ortografia e formatação da resposta, mantendo o conteúdo exato.

INSTRUÇÕES:
1. Corrija erros de português (ortografia, gramática, concordância)
2. Melhore a formatação e clareza do texto
3. Use tom profissional e educado
4. NÃO adicione ou remova informações do conteúdo
5. NÃO use conhecimento externo - apenas corrija o que está escrito
6. Mantenha exatamente o mesmo significado e informações

FORMATO DE SAÍDA:
CRÍTICO: Retorne APENAS a versão corrigida da resposta PRONTA PARA ENVIAR AO CLIENTE.
NÃO inclua frases como "Claro! Aqui está a resposta formatada..." ou "Segue a resposta corrigida...".
Retorne DIRETAMENTE a resposta formatada, sem introduções ou explicações.`;

    const promptParaUsar = customPrompt || defaultGrammarPrompt;
    console.log('📝 Usando prompt:', customPrompt ? 'PERSONALIZADO' : 'PADRÃO (fallback)');

    const response = await openAI('chat/completions', {
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: promptParaUsar
        },
        {
          role: 'user',
          content: `RESPOSTA DO ATENDENTE PARA FORMATAR:
"${mensagem}"

Você deve formatar esta resposta que EU (atendente) escrevi para enviar ao cliente. Não interprete como se fosse uma mensagem do cliente. Formate minha resposta seguindo as instruções do prompt:`
        }
      ],
      max_completion_tokens: 1000
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Erro na correção gramatical:', error);
    return mensagem; // Retorna original em caso de erro
  }
}

async function avaliarParaDocumentacao(respostaCorrigida: string) {
  if (!openaiApiKey) {
    return {
      pode_documentar: false,
      classificacao: "Não",
      resultado: "OpenAI API key não configurada"
    };
  }

  try {
    const response = await openAI('chat/completions', {
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em documentação institucional. 
Avalie se o texto pode ser transformado em documentação oficial.

CRITÉRIOS PARA DOCUMENTAÇÃO:
- Texto completo sem informações faltantes
- Objetivo e claro, sem subjetividade
- Teor institucional (não conversa informal)
- Informação útil para outros atendentes

Responda em JSON com este formato exato:
{
  "pode_documentar": true/false,
  "classificacao": "Sim" ou "Não",
  "resultado": "explicação ou texto formatado para documentação"
}`
        },
        {
          role: 'user',
          content: `Avalie este texto: ${respostaCorrigida}`
        }
      ],
      max_completion_tokens: 500,
      response_format: { type: 'json_object' }
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Erro ao avaliar para documentação:', error);
    return {
      pode_documentar: false,
      classificacao: "Não",
      resultado: "Erro na avaliação"
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando process-response com RAG v4');
    
    const body = await req.json();
    const { mensagem, ticket_id, usuario_id } = body;
    
    console.log('📝 Dados recebidos:', { 
      ticket_id, 
      usuario_id, 
      mensagem_length: mensagem?.length || 0 
    });

    if (!mensagem || !ticket_id || !usuario_id) {
      console.error('❌ Dados obrigatórios ausentes');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Dados obrigatórios ausentes' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar configurações primeiro para decidir o modo
    const { data: aiSettings } = await supabase
      .from('faq_ai_settings')
      .select('usar_base_conhecimento_formatacao')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const usarRAG = aiSettings?.usar_base_conhecimento_formatacao ?? true;
    console.log(`🎯 Modo de formatação: ${usarRAG ? 'RAG v4 + Base de Conhecimento' : 'Apenas Correção Gramatical'}`);

    let documentosCandidatos = [];
    let documentosRanqueados = [];
    let respostaCorrigida;

    if (usarRAG) {
      // 1. RAG v4 - Buscar documentos relacionados usando busca híbrida
      console.log('📚 RAG v4 - Buscando documentos na base de conhecimento...');
      documentosCandidatos = await encontrarDocumentosRelacionados(mensagem, 12);

      // 2. RAG v4 - Re-ranking com LLM para selecionar os melhores
      console.log('🧠 RAG v4 - Re-ranking com LLM...');
      documentosRanqueados = await rerankComLLM(documentosCandidatos, mensagem);

      // 3. Corrigir resposta usando RAG v4
      console.log('🔄 RAG v4 - Corrigindo resposta com base de conhecimento...');
      respostaCorrigida = await corrigirRespostaComRAGv4(mensagem, documentosRanqueados);
      console.log('✅ Resposta corrigida com RAG v4');
    } else {
      // Modo apenas correção gramatical
      console.log('✏️ Corrigindo apenas gramática sem base de conhecimento...');
      respostaCorrigida = await corrigirRespostaComRAGv4(mensagem, []); // Vai usar o modo gramatical
      console.log('✅ Resposta corrigida (apenas gramática)');
    }

    // 4. Avaliar se pode ser documentação
    console.log('📋 Avaliando para documentação...');
    const avaliacao = await avaliarParaDocumentacao(respostaCorrigida);
    console.log('📝 Avaliação:', avaliacao.classificacao);

    // 5. Se pode ser documentação, salvar para aprovação
    if (avaliacao.pode_documentar) {
      console.log('💾 Salvando para aprovação automática...');
      try {
        const { data: aprovacao, error } = await supabase
          .from('knowledge_auto_approvals')
          .insert({
            original_message: mensagem,
            corrected_response: respostaCorrigida,
            documentation_content: avaliacao.resultado,
            similar_documents: documentosRanqueados,
            ticket_id,
            created_by: usuario_id,
            status: 'pending',
            ai_evaluation: avaliacao
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Erro ao salvar aprovação:', error);
        } else {
          console.log('💾 Aprovação salva:', aprovacao.id);
        }
      } catch (error) {
        console.error('❌ Erro ao processar aprovação:', error);
      }
    }

    console.log('✅ RAG v4 processamento concluído com sucesso');

    return new Response(JSON.stringify({
      success: true,
      resposta_corrigida: respostaCorrigida,
      avaliacao_documentacao: avaliacao,
      documentos_encontrados: documentosCandidatos.length,
      documentos_usados: documentosRanqueados.length,
      pode_virar_documento: avaliacao.pode_documentar,
      rag_version: "v4",
      modo_formatacao: usarRAG ? "rag_completo" : "apenas_gramatica"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no RAG v4 processamento:', error);
    console.error('❌ Stack trace:', error.stack);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});