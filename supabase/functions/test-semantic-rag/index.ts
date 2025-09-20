import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Re-ranking com LLM para melhorar a relevância dos resultados
async function rerankComLLM(docs: any[], pergunta: string): Promise<any[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey || docs.length === 0) {
    console.log('⚠️ Sem API key ou documentos para re-ranking');
    return docs;
  }

  try {
    console.log('🔄 Iniciando re-ranking com LLM para', docs.length, 'documentos');

    // Formatar documentos para o LLM
    const documentosFormatados = docs.map((doc, index) => {
      const texto = typeof doc.conteudo === 'object' ? doc.conteudo.texto : doc.conteudo;
      return `[${index + 1}] Título: ${doc.titulo}\nConteúdo: ${texto?.substring(0, 500) || 'Sem conteúdo'}`;
    }).join('\n\n');

    const prompt = `Analise os documentos existentes e determine quais são SEMANTICAMENTE SIMILARES ao novo texto fornecido.

IMPORTANTE: Um documento existente é relevante se:
- Trata do MESMO ASSUNTO/TÓPICO principal
- Contém informações SOBREPOSTAS ou RELACIONADAS
- Pode ser COMPLEMENTAR ou uma VERSÃO EXPANDIDA do novo texto
- O novo texto pode ser uma PARTE/SEÇÃO de um documento maior existente

Novo texto: "${pergunta}"

Documentos existentes:
${documentosFormatados}

Critérios de pontuação:
- 90-100: Mesmo assunto, muito similar ou o novo é parte do existente
- 70-89: Assunto relacionado, informações complementares
- 50-69: Parcialmente relacionado
- 0-49: Pouco ou nada relacionado

Responda APENAS com um array JSON: [{"index": 1, "score": 95}, {"index": 2, "score": 80}]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1000
      }),
    });

    if (!response.ok) {
      console.error('❌ Erro no re-ranking:', await response.text());
      return docs;
    }

    const data = await response.json();
    let ranking;
    
    try {
      ranking = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('❌ Erro no parsing do JSON:', parseError);
      console.log('Conteúdo recebido:', data.choices[0].message.content);
      return docs.slice(0, 5); // Fallback
    }
    
    // Aplicar re-ranking - verificar diferentes formatos de resposta
    let docsComScore = ranking;
    if (ranking.rankings) docsComScore = ranking.rankings;
    if (Array.isArray(ranking)) docsComScore = ranking;
    
    if (!Array.isArray(docsComScore)) {
      console.error('❌ Formato de ranking inválido:', docsComScore);
      return docs.slice(0, 5);
    }
    
    const documentosReRankeados = docsComScore
      .sort((a: any, b: any) => b.score - a.score)
      .map((item: any) => ({
        ...docs[item.index - 1],
        score: item.score / 100,
        similarity: item.score / 100
      }))
      .filter((doc: any) => doc && doc.score > 0.3); // Só documentos com score > 30%

    console.log('✅ Re-ranking concluído:', documentosReRankeados.length, 'documentos relevantes');
    return documentosReRankeados;

  } catch (error) {
    console.error('❌ Erro no re-ranking:', error);
    return docs;
  }
}

// Gerar análise comparativa detalhada
async function gerarAnaliseComparativa(novoConteudo: string, documentosRelacionados: any[]): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openaiApiKey || documentosRelacionados.length === 0) {
    console.log('⚠️ Sem API key ou documentos para análise comparativa');
    return '';
  }

  try {
    console.log('📝 Gerando análise comparativa detalhada');

    const documentosFormatados = documentosRelacionados.map((doc, index) => {
      const texto = typeof doc.conteudo === 'object' ? doc.conteudo.texto : doc.conteudo;
      return `**Documento ${index + 1}: ${doc.titulo}**\n${texto?.substring(0, 800) || 'Sem conteúdo'}`;
    }).join('\n\n');

    const prompt = `Compare o NOVO DOCUMENTO com os DOCUMENTOS EXISTENTES para identificar sobreposições, contradições e recomendar a melhor ação.

**NOVO DOCUMENTO:**
${novoConteudo}

**DOCUMENTOS EXISTENTES:**
${documentosFormatados}

**INSTRUÇÕES IMPORTANTES:**
- Identifique CONTRADIÇÕES entre novo e existente
- Se o novo documento é uma PARTE/SEÇÃO de um existente → Recomende ATUALIZAR
- Se há CONTRADIÇÕES/CONFLITOS → Mencione especificamente
- Se o novo documento é COMPLEMENTAR → Recomende ATUALIZAR  
- Se o novo documento é ÚNICO/DIFERENTE → Recomende CRIAR NOVO

**ANÁLISE:**

## 📄 Novo Documento
**Assunto:** [tema principal]
**Tipo:** [classificação]

## 🔍 Análise de Sobreposição
**Documentos relacionados:** ${documentosRelacionados.length}
**Nível de sobreposição:** [Alto/Médio/Baixo/Nenhum]

## ⚖️ Comparação Detalhada
**Similaridades:**
• [pontos em comum]

**Diferenças:**
• [aspectos únicos do novo]

**⚠️ CONTRADIÇÕES IDENTIFICADAS:**
• [liste contradições específicas entre novo e existente, ou "Nenhuma contradição identificada"]

## 💡 Recomendação Final
${documentosRelacionados.length > 0 ? '**SUGESTÃO: ATUALIZAR DOCUMENTO EXISTENTE**' : '**SUGESTÃO: CRIAR NOVO DOCUMENTO**'}

${documentosRelacionados.length > 0 ? 
  `**Documento para atualizar:** ${documentosRelacionados[0]?.titulo}
**Razão:** [explicar o tipo de atualização necessária]
**Ação:** [descrever como incorporar o novo conteúdo]` : 
  '**Justificativa:** Conteúdo único sem sobreposição significativa'
}

(Máximo 300 palavras)`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 2000
      }),
    });

    if (!response.ok) {
      console.error('❌ Erro na análise comparativa:', await response.text());
      return '';
    }

    const data = await response.json();
    const analise = data.choices[0].message.content;

    console.log('✅ Análise comparativa gerada:', analise.length, 'caracteres');
    return analise;

  } catch (error) {
    console.error('❌ Erro na análise comparativa:', error);
    return '';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 === VERIFICAÇÃO DE ASSUNTOS RELACIONADOS ===');
    
    const { titulo, conteudo } = await req.json();
    const textoCompleto = `Título: ${titulo}\nConteúdo: ${conteudo}`;
    
    console.log('📝 Dados recebidos:');
    console.log('- Título:', titulo || 'Não informado');
    console.log('- Conteúdo length:', conteudo?.length || 0);
    console.log('- Texto completo preview:', textoCompleto.substring(0, 200) + '...');

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key não configurada');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Credenciais do Supabase não configuradas');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🎯 ETAPA 1: GERANDO EMBEDDING');
    console.log('- Modelo usado: text-embedding-3-small');
    console.log('- Texto completo length:', textoCompleto.length);
    console.log('- Primeiros 200 chars:', textoCompleto.substring(0, 200));

    // Truncar texto para evitar exceder limite de tokens (8192)
    // Estimativa: ~4 caracteres por token, então limitamos a ~6000 caracteres para ter margem
    const textoParaEmbedding = textoCompleto.length > 6000 
      ? textoCompleto.substring(0, 6000) + '...'
      : textoCompleto;

    console.log('- Texto truncado length:', textoParaEmbedding.length);

    // Gerar embedding usando OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: textoParaEmbedding,
        model: 'text-embedding-3-small'
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error('❌ ERRO NO EMBEDDING:', error);
      throw new Error(`OpenAI Embeddings error: ${error}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('✅ EMBEDDING CRIADO COM SUCESSO');
    console.log('- Dimensões do embedding:', queryEmbedding.length);
    console.log('- Primeiros 5 valores:', queryEmbedding.slice(0, 5));

    console.log('🎯 ETAPA 2: VERIFICANDO DOCUMENTOS NA BASE');
    
    // Primeiro verificar quantos documentos temos
    const { data: totalDocs, error: countError } = await supabase
      .from('documentos')
      .select('id, titulo, categoria')
      .eq('status', 'ativo');
      
    console.log('📊 DOCUMENTOS DISPONÍVEIS:', totalDocs?.length || 0);
    if (totalDocs) {
      totalDocs.forEach(doc => {
        console.log(`- ${doc.titulo} (${doc.categoria})`);
      });
    }

    const MAXIMO_DE_DOCUMENTOS = 12;
    
    console.log('🎯 ETAPA 3: FAZENDO BUSCA SEMÂNTICA');
    
    // TESTE: Primeiro vamos tentar busca simples usando match_documentos_semantico
    console.log('🔍 TESTANDO BUSCA SIMPLES PRIMEIRO');
    
    const { data: candidatosSimples, error: errorSimples } = await supabase.rpc('match_documentos_semantico', {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: MAXIMO_DE_DOCUMENTOS
    });
    
    console.log('📋 BUSCA SIMPLES - Resultado:');
    console.log('- error:', errorSimples);
    console.log('- candidatos encontrados:', candidatosSimples?.length || 0);
    
    if (candidatosSimples && candidatosSimples.length > 0) {
      console.log('✅ ENCONTROU NA BUSCA SIMPLES:');
      candidatosSimples.forEach((c, i) => {
        console.log(`  ${i+1}. ${c.titulo} (similarity: ${c.similarity})`);
      });
    } else {
      console.log('❌ BUSCA SIMPLES NÃO ENCONTROU NADA');
      if (errorSimples) {
        console.error('Erro na busca simples:', errorSimples);
      }
    }

    console.log('🔍 TESTANDO BUSCA HÍBRIDA');
    
    // Usa a mesma função híbrida dos outros sistemas com parâmetros corretos
    const { data: candidatos, error } = await supabase.rpc('match_documentos_hibrido', {
      query_embedding: queryEmbedding,
      query_text: textoCompleto,
      match_count: MAXIMO_DE_DOCUMENTOS,
      alpha: 0.85 // Peso da busca vetorial (85%) vs textual (15%)
    });

    console.log('📋 BUSCA HÍBRIDA - Resultado:');
    console.log('- error:', error);
    console.log('- candidatos encontrados:', candidatos?.length || 0);
    
    if (candidatos && candidatos.length > 0) {
      console.log('✅ HÍBRIDA - Documentos encontrados:');
      candidatos.forEach((c, i) => {
        console.log(`  ${i+1}. ${c.titulo} (similarity: ${c.similarity})`);
      });
    } else {
      console.log('❌ BUSCA HÍBRIDA NÃO ENCONTROU NADA');
      if (error) {
        console.error('Erro na busca híbrida:', error);
      }
    }

    console.log('🎯 ETAPA 4: PROCESSANDO RESULTADOS');
    
    // Use busca simples se híbrida falhou, senão use híbrida
    let artigosRelacionados = candidatos && candidatos.length > 0 ? candidatos : (candidatosSimples || []);
    
    console.log('📊 ARTIGOS SELECIONADOS PARA ANÁLISE:', artigosRelacionados.length);

    if (artigosRelacionados.length === 0) {
      console.log('❌ NENHUM DOCUMENTO RELACIONADO ENCONTRADO');
      
      return new Response(JSON.stringify({
        documentos_relacionados: [],
        recomendacao: "Ótimo! Nenhum documento parecido encontrado. Este parece ser um conteúdo novo.",
        analise_comparativa: null,
        deve_criar_novo: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎯 ETAPA 5: RE-RANKING COM LLM');
    
    // Re-ranking com LLM se temos candidatos
    const documentosReRankeados = await rerankComLLM(artigosRelacionados, textoCompleto);
    
    console.log('📊 DOCUMENTOS APÓS RE-RANKING:', documentosReRankeados.length);
    documentosReRankeados.forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.titulo} (score: ${doc.score})`);
    });

    console.log('🎯 ETAPA 6: GERANDO ANÁLISE COMPARATIVA');
    
    const analiseComparativa = await gerarAnaliseComparativa(textoCompleto, documentosReRankeados);
    
    console.log('✅ ANÁLISE COMPARATIVA GERADA');
    console.log('- Tamanho da análise:', analiseComparativa?.length || 0, 'caracteres');

    console.log('🎯 ETAPA 7: PREPARANDO RESPOSTA FINAL');
    
    const resposta = {
      documentos_relacionados: documentosReRankeados.map(doc => ({
        id: doc.id,
        titulo: doc.titulo,
        conteudo: doc.conteudo,
        categoria: doc.categoria,
        versao: doc.versao || 1,
        similaridade: Math.round((doc.score || doc.similarity || 0) * 100),
        criado_em: doc.criado_em,
        status: doc.status,
        tags: doc.tags || [],
        profile: doc.profile
      })),
      recomendacao: "Atenção! Encontramos documentos similares. Considere atualizar um existente.",
      analise_comparativa: analiseComparativa,
      deve_criar_novo: false
    };
    
    console.log('✅ PROCESSO CONCLUÍDO COM SUCESSO');
    console.log('- Documentos relacionados:', resposta.documentos_relacionados.length);
    console.log('- Tem análise comparativa:', !!resposta.analise_comparativa);

    return new Response(JSON.stringify(resposta), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na verificação de assuntos relacionados:', error);
    return new Response(JSON.stringify({
      error: 'Falha na consulta à base de conhecimento.',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});