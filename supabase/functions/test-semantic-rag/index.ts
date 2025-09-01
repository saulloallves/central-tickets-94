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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, assunto, categoria } = await req.json();
    
    if (!query) {
      throw new Error('Query é obrigatório');
    }

    console.log('=== TESTE RAG SEMÂNTICO ===');
    console.log('Query:', query);
    console.log('Assunto:', assunto);
    console.log('Categoria:', categoria);

    // 1. CRIAR EMBEDDING SEMÂNTICO RICO EM CONTEXTO
    const queryContextual = `
ASSUNTO/PROBLEMA: ${assunto || 'Análise geral'}
CATEGORIA: ${categoria || 'Geral'}
CONTEXTO: ${query}
INTENT: Buscar documentos que tratam do mesmo tipo de problema/assunto
FOCO: Compreensão semântica do problema, não apenas palavras
    `.trim();

    console.log('Query contextual para embedding:', queryContextual);

    // 2. GERAR EMBEDDING COM MODELO MAIS AVANÇADO
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: queryContextual,
        dimensions: 1536
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      throw new Error(`OpenAI Embeddings error: ${error}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('Embedding gerado com dimensões:', queryEmbedding.length);

    // 3. BUSCA SEMÂNTICA AVANÇADA
    const { data: resultadosSemanticos, error: semanticoError } = await supabase.rpc('match_documentos_semantico', {
      query_embedding: queryEmbedding,
      query_text: query,
      match_threshold: 0.60, // Threshold mais permissivo para teste
      match_count: 10,
      require_category_match: categoria ? true : false,
      categoria_filtro: categoria
    });

    if (semanticoError) {
      console.error('Erro na busca semântica:', semanticoError);
      throw semanticoError;
    }

    console.log(`Busca semântica encontrou ${resultadosSemanticos?.length || 0} documentos`);

    // 4. BUSCA TRADICIONAL PARA COMPARAÇÃO
    const { data: resultadosTradicionais, error: tradicionalError } = await supabase.rpc('match_documentos', {
      query_embedding: queryEmbedding,
      match_threshold: 0.60,
      match_count: 10
    });

    if (tradicionalError) {
      console.error('Erro na busca tradicional:', tradicionalError);
    }

    // 5. ANÁLISE COMPARATIVA DOS RESULTADOS
    const analiseSemantica = resultadosSemanticos?.map(doc => ({
      id: doc.id,
      titulo: doc.titulo,
      categoria: doc.categoria,
      similaridade_vetorial: (doc.similaridade * 100).toFixed(1) + '%',
      relevancia_semantica: ((doc.relevancia_semantica || 0) * 100).toFixed(1) + '%',
      score_final: ((doc.score_final || doc.similaridade) * 100).toFixed(1) + '%',
      conteudo_preview: typeof doc.conteudo === 'string' ? 
        doc.conteudo.substring(0, 200) + '...' : 
        JSON.stringify(doc.conteudo).substring(0, 200) + '...'
    })) || [];

    const analiseTradicional = resultadosTradicionais?.map(doc => ({
      id: doc.id,
      titulo: doc.titulo,
      categoria: doc.categoria,
      similaridade: (doc.similaridade * 100).toFixed(1) + '%',
      conteudo_preview: typeof doc.conteudo === 'string' ? 
        doc.conteudo.substring(0, 200) + '...' : 
        JSON.stringify(doc.conteudo).substring(0, 200) + '...'
    })) || [];

    // 6. DEMONSTRAR DIFERENÇA SEMÂNTICA
    console.log('=== RESULTADOS COMPARATIVOS ===');
    console.log('Semântico:', analiseSemantica.length, 'docs');
    console.log('Tradicional:', analiseTradicional.length, 'docs');

    return new Response(JSON.stringify({
      sucesso: true,
      query_original: query,
      query_contextual: queryContextual,
      assunto_detectado: assunto,
      categoria_filtro: categoria,
      resultados: {
        busca_semantica: {
          total: analiseSemantica.length,
          documentos: analiseSemantica,
          metodo: 'Embedding contextual + Score semântico'
        },
        busca_tradicional: {
          total: analiseTradicional.length,
          documentos: analiseTradicional,
          metodo: 'Embedding simples + Similaridade cosseno'
        }
      },
      diferenca_semantic: {
        melhor_contexto: analiseSemantica.length > 0 ? analiseSemantica[0] : null,
        explicacao: 'A busca semântica combina similaridade vetorial com relevância contextual para entender o ASSUNTO, não apenas palavras'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no teste RAG semântico:', error);
    return new Response(JSON.stringify({ 
      erro: error.message,
      contexto: 'Teste de busca semântica avançada'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});