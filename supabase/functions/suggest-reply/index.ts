
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
    const { ticketId } = await req.json();
    
    if (!ticketId) {
      throw new Error('ticketId is required');
    }

    console.log('Generating RAG-powered suggestion for ticket:', ticketId);

    // 1. Fetch AI settings
    const { data: aiSettings, error: settingsError } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching AI settings:', settingsError);
      throw new Error(`AI settings error: ${settingsError.message}`);
    }

    if (!aiSettings) {
      console.error('No active AI settings found');
      throw new Error('AI settings not configured');
    }

    // 2. Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades(id, grupo),
        colaboradores(nome_completo, email)
      `)
      .eq('id', ticketId)
      .maybeSingle();

    if (ticketError || !ticket) {
      console.error('Error fetching ticket:', ticketError);
      throw new Error('Ticket not found');
    }

    // 3. RAG PIPELINE: Vetorizar o ticket
    console.log('Vetorizando ticket para busca RAG...');
    const textoTicket = `${ticket.descricao_problema} ${ticket.categoria || ''}`.trim();
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: textoTicket,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      throw new Error(`OpenAI Embeddings error: ${error}`);
    }

    const embeddingData = await embeddingResponse.json();
    const ticketEmbedding = embeddingData.data[0].embedding;

    // 4. BUSCA SEGURA RAG: Usar a função match_documentos
    console.log('Executando busca RAG na base de conhecimento...');
    const { data: contextoDocs, error: ragError } = await supabase.rpc('match_documentos', {
      query_embedding: ticketEmbedding,
      match_threshold: 0.70, // Limiar de relevância
      match_count: 5 // Top 5 documentos mais relevantes
    });

    if (ragError) {
      console.error('Erro na busca RAG:', ragError);
      throw ragError;
    }

    console.log(`RAG encontrou ${contextoDocs?.length || 0} documentos relevantes`);

    // 5. Construir contexto governado para o GPT
    const contextSections = [];
    
    contextSections.push(`CONTEXTO DO TICKET:
- Código: ${ticket.codigo_ticket}
- Unidade: ${ticket.unidades?.grupo || ticket.unidade_id}
- Categoria: ${ticket.categoria || 'Não especificada'}
- Prioridade: ${ticket.prioridade}
- Status: ${ticket.status}
- Descrição: ${ticket.descricao_problema}`);

    // Adicionar documentos RAG com citações completas
    if (contextoDocs && contextoDocs.length > 0) {
      const documentosFormatados = contextoDocs.map((doc, index) => {
        return `**FONTE ${index + 1}** - ${doc.titulo} (v${doc.versao}) - Relevância: ${(doc.similaridade * 100).toFixed(1)}%
${typeof doc.conteudo === 'object' ? JSON.stringify(doc.conteudo, null, 2) : doc.conteudo}`;
      }).join('\n\n---\n\n');

      contextSections.push(`=== BASE DE CONHECIMENTO GOVERNADA ===
${documentosFormatados}`);
    } else {
      contextSections.push('=== BASE DE CONHECIMENTO ===\nNenhum documento relevante encontrado na base governada.');
    }

    const contextoCompleto = contextSections.join('\n\n');

    // 6. Prompt estruturado para GPT-4o
    const systemPrompt = `Você é um assistente especializado em suporte técnico da Cresci & Perdi.

REGRAS OBRIGATÓRIAS:
- Use EXCLUSIVAMENTE as informações da base de conhecimento governada fornecida
- Cite sempre as fontes usando o formato: [FONTE X - Título]
- Se não houver informação suficiente, diga claramente: "Informação não encontrada na base de conhecimento"
- Seja conciso, direto e objetivo (máximo 200 palavras)
- Use linguagem técnica mas acessível para atendentes

FORMATO DA RESPOSTA:
1. Resposta principal (baseada nas fontes)
2. Fontes consultadas: [FONTE X - Título (vX)]`;

    const userPrompt = `${contextoCompleto}

INSTRUÇÃO: Com base exclusivamente nas informações da base de conhecimento governada acima, sugira uma resposta para resolver o problema do ticket.`;

    // 7. Gerar resposta com GPT-4o
    console.log('Gerando resposta com GPT-4o...');
    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: aiSettings.max_tokens_sugestao || 800
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`GPT-4o API error: ${errorText}`);
    }

    const apiData = await apiResponse.json();
    const respostaSugerida = apiData.choices[0].message.content;

    // 8. Salvar no banco com métricas RAG
    const { data: suggestionRecord, error: saveError } = await supabase
      .from('ticket_ai_interactions')
      .insert({
        ticket_id: ticketId,
        kind: 'suggestion',
        resposta: respostaSugerida,
        model: 'gpt-4o',
        params: {
          temperature: 0.3,
          max_tokens: aiSettings.max_tokens_sugestao || 800
        },
        log: {
          rag_pipeline: 'v2_governado',
          embedding_model: 'text-embedding-3-large',
          documentos_encontrados: contextoDocs?.length || 0,
          relevancia_media: contextoDocs?.length ? 
            (contextoDocs.reduce((acc, doc) => acc + doc.similaridade, 0) / contextoDocs.length) : 0,
          contexto_size: contextoCompleto.length,
          fontes_citadas: contextoDocs?.map(doc => ({
            id: doc.id,
            titulo: doc.titulo,
            versao: doc.versao,
            relevancia: doc.similaridade
          })) || []
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving suggestion:', saveError);
      throw saveError;
    }

    console.log('RAG-powered suggestion generated successfully');

    return new Response(JSON.stringify({
      resposta: respostaSugerida,
      rag_metrics: {
        documentos_encontrados: contextoDocs?.length || 0,
        relevancia_media: contextoDocs?.length ? 
          ((contextoDocs.reduce((acc, doc) => acc + doc.similaridade, 0) / contextoDocs.length) * 100).toFixed(1) + '%' : '0%',
        fontes_utilizadas: contextoDocs?.length || 0
      },
      pipeline_version: 'RAG_v2_Governado'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in RAG suggest-reply function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
