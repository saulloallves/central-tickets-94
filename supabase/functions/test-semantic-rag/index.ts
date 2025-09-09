import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

// Reutiliza a mesma lógica de re-ranking dos outros sistemas
async function rerankComLLM(docs: any[], pergunta: string) {
  if (!docs || docs.length === 0) return [];

  try {
    console.log('🧠 Re-ranking com LLM...');
    
    const docsParaAnalise = docs.map((doc) => 
      `ID: ${doc.id}\nTítulo: ${doc.titulo}\nConteúdo: ${JSON.stringify(doc.conteudo).substring(0, 800)}`
    ).join('\n\n---\n\n');

    const prompt = `Você deve analisar os documentos e classificar sua relevância para o conteúdo que o usuário quer criar.

CONTEÚDO A SER CRIADO: "${pergunta}"

DOCUMENTOS EXISTENTES:
${docsParaAnalise}

Retorne APENAS um JSON válido com array "scores" contendo objetos com "id" e "score" (0-100):
{"scores": [{"id": "doc-id", "score": 85}, ...]}

Critérios para detectar similaridade:
- Score 80-100: Muito similar, pode estar duplicando conteúdo
- Score 60-79: Parcialmente similar, considere atualizar
- Score 40-59: Relacionado ao tema
- Score 0-39: Pouco relacionado`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 1000,
        response_format: { type: 'json_object' }
      })
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { titulo, conteudo } = await req.json();
    
    if (!titulo && !conteudo) {
      throw new Error('Título ou conteúdo é obrigatório');
    }

    // Combina título + conteúdo conforme a documentação
    const textoCompleto = `Título: ${titulo || ''}\nConteúdo: ${conteudo || ''}`.trim();
    
    if (textoCompleto.length < 50) {
      console.log("Texto muito curto para análise semântica");
      return new Response(JSON.stringify({
        documentos_relacionados: [],
        recomendacao: "Texto muito curto para análise. Escreva mais conteúdo."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('=== VERIFICAÇÃO DE ASSUNTOS RELACIONADOS ===');
    console.log('Texto completo:', textoCompleto.substring(0, 200) + '...');

    // Gera o embedding conforme a documentação
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small', // Usando o modelo padrão do sistema
        input: textoCompleto,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      throw new Error(`OpenAI Embeddings error: ${error}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('Embedding gerado com sucesso');
    console.log('Dimensões do embedding:', queryEmbedding.length);

    // Usa a mesma busca híbrida dos outros sistemas
    const LIMIAR_DE_RELEVANCIA = 0.1; // Mesmo threshold do suggest-reply
    const MAXIMO_DE_DOCUMENTOS = 12;   // Busca mais documentos para depois re-ranking

    console.log('Iniciando busca híbrida com parâmetros:');
    console.log('- match_threshold:', LIMIAR_DE_RELEVANCIA);
    console.log('- match_count:', MAXIMO_DE_DOCUMENTOS);

    // Usa a mesma função híbrida dos outros sistemas
    const { data: candidatos, error } = await supabase.rpc('match_documentos_hibrido', {
      query_embedding: queryEmbedding,
      query_text: textoCompleto,
      match_threshold: LIMIAR_DE_RELEVANCIA,
      match_count: MAXIMO_DE_DOCUMENTOS
    });

    console.log('Resultado da busca híbrida:');
    console.log('- error:', error);
    console.log('- candidatos:', candidatos?.length || 0);

    if (error) {
      console.error("Erro ao verificar assuntos relacionados:", error);
      throw new Error("Falha na consulta à base de conhecimento.");
    }

    let artigosRelacionados = candidatos || [];
    
    // Re-ranking com LLM como os outros sistemas
    if (artigosRelacionados.length > 0) {
      console.log('🧠 Aplicando re-ranking com LLM...');
      artigosRelacionados = await rerankComLLM(artigosRelacionados, textoCompleto);
    }
    console.log(`Encontrados ${artigosRelacionados.length} documentos relacionados`);

    // Formata resultado conforme esperado pela interface
    if (artigosRelacionados.length > 0) {
      const documentosFormatados = artigosRelacionados.map(doc => ({
        id: doc.id,
        titulo: doc.titulo,
        versao: doc.versao || 1,
        similaridade: Math.round(doc.similaridade * 100),
        categoria: doc.categoria,
        conteudo_preview: typeof doc.conteudo === 'string' ? 
          doc.conteudo.substring(0, 200) + '...' : 
          'Conteúdo estruturado'
      }));

      return new Response(JSON.stringify({
        documentos_relacionados: documentosFormatados,
        recomendacao: "Atenção! Encontramos artigos que já falam sobre este assunto. Considere atualizar um desses artigos em vez de criar um novo.",
        deve_criar_novo: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({
        documentos_relacionados: [],
        recomendacao: "Ótimo! Nenhum artigo parecido encontrado. Este parece ser um conteúdo novo.",
        deve_criar_novo: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Erro na verificação de assuntos relacionados:', error);
    return new Response(JSON.stringify({ 
      erro: error.message,
      documentos_relacionados: [],
      recomendacao: "Erro na análise. Tente novamente."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});