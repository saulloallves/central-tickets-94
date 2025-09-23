import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
 * RAG v4 - Busca híbrida usando embeddings + keywords
 */
async function encontrarDocumentosRelacionados(textoMensagem: string, limiteResultados: number = 12) {
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

    console.log('🔎 Executando busca híbrida v4...');
    
    const { data: candidatos, error } = await supabase.rpc('match_documentos_hibrido', {
      query_embedding: queryEmbedding,
      query_text: textoMensagem,
      match_count: limiteResultados,
      alpha: 0.5
    });

    if (error) {
      console.error('Erro na busca híbrida:', error);
      return [];
    }

    console.log(`🔎 RAG v4 → ${candidatos?.length || 0} candidatos`);
    return candidatos || [];
    
  } catch (error) {
    console.error('Erro ao buscar documentos relacionados:', error);
    return [];
  }
}

/**
 * RAG v4 - Re-ranking com LLM usando GPT-4.1
 */
async function rerankComLLM(docs: any[], pergunta: string) {
  if (!docs || docs.length === 0) return [];

  try {
    console.log('🧠 Re-ranking com LLM v4...');
    
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
    
    console.log(`RAG v4 rerank parsed items: ${result.scores?.length || 0}`);
    
    if (!result.scores) return docs.slice(0, 5);

    // Ordenar por score e pegar top 5
    const rankedDocs = result.scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => docs.find(doc => doc.id === item.id))
      .filter(Boolean);

    const docIds = rankedDocs.map(doc => doc.id).join(' | ');
    console.log(`Docs selecionados para resposta: ${docIds}`);

    return rankedDocs;
    
  } catch (error) {
    console.error('Erro no reranking LLM:', error);
    return docs.slice(0, 5);
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

    // Usar prompt configurável ou fallback para o padrão
    const customPrompt = aiSettings?.prompt_format_response;
    const defaultPrompt = `Você é um especialista em atendimento ao cliente da Cresci & Perdi. 

IMPORTANTE: Você deve corrigir e padronizar a resposta do atendente seguindo estas regras:

🔧 CORREÇÃO E PADRONIZAÇÃO:
1. Corrija português (ortografia, gramática, concordância)
2. Use tom educado, profissional e acolhedor
3. Mantenha o conteúdo essencial da resposta
4. Torne a resposta mais clara, completa e detalhada
5. Use linguagem institucional consistente

📚 VALIDAÇÃO COM BASE DE CONHECIMENTO (RAG v4):
- Se houver informações na base de conhecimento relacionadas à resposta, SEMPRE priorize e use essas informações oficiais
- Se a resposta do atendente contradizer a base de conhecimento, corrija usando as informações oficiais
- Se não houver informações relevantes na base, apenas faça a correção de forma e tom
- NUNCA invente informações que não estão na base de conhecimento
- Use as informações dos documentos fornecidos como referência oficial
- NUNCA cite códigos de manuais, procedimentos ou documentos específicos (como "PRO 02.02", "Manual XYZ", etc.)
- Incorpore as informações de forma natural sem referenciar a fonte

📋 FORMATO DE SAÍDA:
Retorne apenas a versão corrigida e padronizada da resposta, sem explicações adicionais ou referências a documentos.`;

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
Retorne apenas a versão corrigida da resposta, sem explicações adicionais.`;

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
          content: `TEXTO PARA CORRIGIR APENAS GRAMÁTICA E FORMATAÇÃO:
${mensagem}

Corrija apenas gramática, ortografia e formatação, mantendo o conteúdo exato:`
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

serve(async (req) => {
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