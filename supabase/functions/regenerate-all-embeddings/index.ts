import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 === REGENERANDO TODOS OS EMBEDDINGS ===');
    
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

    // Buscar todos os documentos ativos
    console.log('📋 Buscando documentos ativos...');
    const { data: documentos, error: fetchError } = await supabase
      .from('documentos')
      .select('id, titulo, conteudo, categoria')
      .eq('status', 'ativo');

    if (fetchError) {
      throw new Error(`Erro ao buscar documentos: ${fetchError.message}`);
    }

    if (!documentos || documentos.length === 0) {
      console.log('⚠️ Nenhum documento ativo encontrado');
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum documento ativo encontrado',
        processados: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Encontrados ${documentos.length} documentos para processar:`);
    documentos.forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.titulo} (${doc.categoria})`);
    });

    let sucessos = 0;
    let falhas = 0;
    const resultados = [];

    // Processar cada documento
    for (const documento of documentos) {
      try {
        console.log(`🔄 Processando: ${documento.titulo}`);
        
        // Extrair texto do conteúdo
        let textoCompleto = '';
        if (documento.conteudo) {
          if (typeof documento.conteudo === 'object' && documento.conteudo.texto) {
            textoCompleto = documento.conteudo.texto;
          } else if (typeof documento.conteudo === 'string') {
            textoCompleto = documento.conteudo;
          }
        }

        // Incluir título no texto para embedding
        const textoParaEmbedding = `${documento.titulo}\n\n${textoCompleto}`;
        
        console.log(`📝 Texto length: ${textoParaEmbedding.length} chars`);
        console.log(`📝 Preview: ${textoParaEmbedding.substring(0, 100)}...`);

        // Gerar novo embedding usando o modelo atual
        console.log('🧠 Gerando embedding com text-embedding-3-small...');
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
          throw new Error(`OpenAI error: ${error}`);
        }

        const embeddingData = await embeddingResponse.json();
        const novoEmbedding = embeddingData.data[0].embedding;
        
        console.log(`✅ Embedding gerado: ${novoEmbedding.length} dimensões`);

        // Atualizar o documento com o novo embedding
        const { error: updateError } = await supabase
          .from('documentos')
          .update({ 
            embedding: novoEmbedding,
            processado_por_ia: true 
          })
          .eq('id', documento.id);

        if (updateError) {
          throw new Error(`Erro ao atualizar: ${updateError.message}`);
        }

        console.log(`✅ Documento atualizado: ${documento.titulo}`);
        
        sucessos++;
        resultados.push({
          id: documento.id,
          titulo: documento.titulo,
          status: 'sucesso',
          embedding_dimensions: novoEmbedding.length
        });

        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Erro ao processar ${documento.titulo}:`, error);
        falhas++;
        resultados.push({
          id: documento.id,
          titulo: documento.titulo,
          status: 'falha',
          erro: error.message
        });
      }
    }

    console.log('🎯 === REGENERAÇÃO CONCLUÍDA ===');
    console.log(`✅ Sucessos: ${sucessos}`);
    console.log(`❌ Falhas: ${falhas}`);
    console.log(`📊 Total processado: ${documentos.length}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Regeneração concluída: ${sucessos} sucessos, ${falhas} falhas`,
      total_documentos: documentos.length,
      sucessos,
      falhas,
      resultados
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na regeneração de embeddings:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Falha na regeneração de embeddings',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});