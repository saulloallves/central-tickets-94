
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { titulo, conteudo, tipo, valido_ate, tags, justificativa, artigo_id } = await req.json();
    
    if (!titulo || !conteudo || !justificativa) {
      return new Response(
        JSON.stringify({ error: 'Título, conteúdo e justificativa são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processando documento:', titulo);

    // 1. Preparar texto para embedding
    const textoParaEmbedding = `Título: ${titulo}\nConteúdo: ${typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo)}`;

    // 2. Gerar embedding usando text-embedding-3-large
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
      throw new Error(`Erro na OpenAI Embeddings: ${error}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    console.log('Embedding gerado, dimensões:', embedding.length);

    // 3. LÓGICA DO "PORTEIRO": Verificar duplicatas usando busca vetorial
    if (!artigo_id) { // Apenas para novos artigos
      const { data: similares } = await supabase.rpc('match_documentos', {
        query_embedding: embedding,
        match_threshold: 0.85, // Limiar alto para detectar duplicatas
        match_count: 3
      });

      if (similares && similares.length > 0) {
        console.log('Documentos similares encontrados:', similares.length);
        return new Response(
          JSON.stringify({ 
            warning: 'duplicate_found',
            similar_documents: similares,
            message: 'Encontramos documentos similares. Deseja criar uma nova versão ou prosseguir?'
          }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // 4. Inserir/Atualizar documento
    const documentData = {
      titulo,
      conteudo: typeof conteudo === 'string' ? { texto: conteudo } : conteudo,
      tipo: tipo || 'permanente',
      valido_ate,
      tags: tags || [],
      justificativa,
      criado_por: (await supabase.auth.getUser()).data.user?.id,
      embedding,
      artigo_id: artigo_id || crypto.randomUUID()
    };

    if (artigo_id) {
      // Nova versão de artigo existente
      const { data: ultimaVersao } = await supabase
        .from('documentos')
        .select('versao')
        .eq('artigo_id', artigo_id)
        .order('versao', { ascending: false })
        .limit(1)
        .single();

      documentData.versao = (ultimaVersao?.versao || 0) + 1;
    }

    const { data, error } = await supabase
      .from('documentos')
      .insert(documentData)
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir documento:', error);
      throw error;
    }

    console.log('Documento criado com sucesso:', data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        document: data,
        message: artigo_id ? 'Nova versão criada com sucesso' : 'Documento criado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função kb-upsert-document:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
