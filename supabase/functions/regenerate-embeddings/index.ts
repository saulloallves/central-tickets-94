import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
// import { wrapAIFunction } from '../_shared/ai-alert-utils.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando regeneração de embeddings...');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // 1. Buscar documentos que precisam de novos embeddings
    const { data: documents, error: fetchError } = await supabase
      .from('documentos')
      .select('id, titulo, conteudo, categoria')
      .eq('status', 'ativo');

    if (fetchError) {
      throw new Error(`Erro ao buscar documentos: ${fetchError.message}`);
    }

    console.log(`📊 Encontrados ${documents?.length || 0} documentos para processar`);

    let processedCount = 0;
    let errorCount = 0;

    // 2. Processar cada documento
    for (const doc of documents || []) {
      try {
        console.log(`🔄 Processando documento: ${doc.titulo}`);

        // Criar texto para embedding
        const textoParaEmbedding = `Título: ${doc.titulo}\nConteúdo: ${
          typeof doc.conteudo === 'string' 
            ? doc.conteudo 
            : JSON.stringify(doc.conteudo)
        }`;

        // Gerar novo embedding com monitoramento de alerta
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: textoParaEmbedding,
          }),
        });

        if (!embeddingResponse.ok) {
          const error = await embeddingResponse.text();
          throw new Error(`OpenAI Embeddings API error: ${embeddingResponse.status} - ${error}`);
        }

        const embeddingData = await embeddingResponse.json();
        const newEmbedding = embeddingData.data[0].embedding;

        console.log(`✅ Embedding gerado para ${doc.titulo} - dimensões: ${newEmbedding.length}`);

        // Atualizar documento com novo embedding
        const { error: updateError } = await supabase
          .from('documentos')
          .update({ embedding: newEmbedding })
          .eq('id', doc.id);

        if (updateError) {
          console.error(`❌ Erro ao atualizar documento ${doc.titulo}:`, updateError);
          errorCount++;
        } else {
          console.log(`✅ Documento ${doc.titulo} atualizado com sucesso`);
          processedCount++;
        }

        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (docError) {
        console.error(`❌ Erro ao processar documento ${doc.titulo}:`, docError);
        errorCount++;
      }
    }

    console.log(`🎉 Regeneração concluída! Processados: ${processedCount}, Erros: ${errorCount}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Embeddings regenerados com sucesso',
      processedCount,
      errorCount,
      totalDocuments: documents?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 ERRO na regeneração de embeddings:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});