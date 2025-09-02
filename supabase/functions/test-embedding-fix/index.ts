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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testando regeneração de embedding para documento específico...');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Buscar o documento de pró-labore específico
    const { data: doc, error: fetchError } = await supabase
      .from('documentos')
      .select('id, titulo, conteudo, categoria')
      .eq('id', '7c72cd7a-77a0-4848-b06c-a7906ce68a5f')
      .single();

    if (fetchError || !doc) {
      throw new Error(`Documento não encontrado: ${fetchError?.message}`);
    }

    console.log('📄 Documento encontrado:', doc.titulo);

    // Criar texto para embedding
    const textoParaEmbedding = `Título: ${doc.titulo}\nConteúdo: ${
      typeof doc.conteudo === 'string' 
        ? doc.conteudo 
        : JSON.stringify(doc.conteudo)
    }`;

    console.log('🔤 Texto para embedding (primeiros 200 chars):', textoParaEmbedding.substring(0, 200));

    // Gerar embedding com text-embedding-3-large (3072 dimensões)
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: textoParaEmbedding,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const embeddingData = await embeddingResponse.json();
    const newEmbedding = embeddingData.data[0].embedding;

    console.log(`✅ Embedding gerado - dimensões: ${newEmbedding.length}`);

    // Atualizar documento com novo embedding
    const { error: updateError } = await supabase
      .from('documentos')
      .update({ embedding: newEmbedding })
      .eq('id', doc.id);

    if (updateError) {
      throw new Error(`Erro ao atualizar documento: ${updateError.message}`);
    }

    console.log(`✅ Documento atualizado com sucesso`);

    // Testar a busca semântica
    console.log('🔍 Testando busca semântica...');
    
    const testQuery = "o que é pró-labore";
    const testEmbeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: testQuery,
      }),
    });

    const testEmbeddingData = await testEmbeddingResponse.json();
    const queryEmbedding = testEmbeddingData.data[0].embedding;

    const { data: searchResults, error: searchError } = await supabase.rpc('match_documentos', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5
    });

    console.log('🎯 Resultados da busca:', searchResults);

    return new Response(JSON.stringify({
      success: true,
      message: 'Teste concluído com sucesso',
      document: {
        id: doc.id,
        titulo: doc.titulo,
        embedding_dimensions: newEmbedding.length
      },
      searchTest: {
        query: testQuery,
        results: searchResults?.length || 0,
        documents: searchResults
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 ERRO no teste:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});