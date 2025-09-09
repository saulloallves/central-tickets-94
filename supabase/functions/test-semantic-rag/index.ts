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

    // Configura busca conforme a documentação
    const LIMIAR_DE_RELEVANCIA = 0.5; // Limiar mais baixo para pegar ideias relacionadas
    const MAXIMO_DE_DOCUMENTOS = 5;    // Lista útil para análise

    console.log('Iniciando busca com parâmetros:');
    console.log('- match_threshold:', LIMIAR_DE_RELEVANCIA);
    console.log('- match_count:', MAXIMO_DE_DOCUMENTOS);

    // Chama a função match_documentos conforme a documentação
    const { data: documentosExistentes, error } = await supabase.rpc('match_documentos', {
      query_embedding: queryEmbedding,
      match_threshold: LIMIAR_DE_RELEVANCIA,
      match_count: MAXIMO_DE_DOCUMENTOS
    });

    console.log('Resultado da busca:');
    console.log('- error:', error);
    console.log('- documentosExistentes:', documentosExistentes);
    console.log('- quantidade encontrada:', documentosExistentes?.length || 0);

    if (error) {
      console.error("Erro ao verificar assuntos relacionados:", error);
      throw new Error("Falha na consulta à base de conhecimento.");
    }

    const artigosRelacionados = documentosExistentes || [];
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