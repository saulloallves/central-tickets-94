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

async function buscarDocumentosRelacionados(mensagem: string) {
  if (!openaiApiKey) {
    console.log('⚠️ OpenAI API key não configurada para busca semântica');
    return [];
  }

  try {
    console.log('🔍 Gerando embedding para busca...');
    
    // Gerar embedding da mensagem
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: mensagem,
        encoding_format: 'float'
      })
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Embedding API error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('🔎 Buscando documentos relacionados...');

    // Buscar documentos similares usando a função híbrida
    const { data, error } = await supabase.rpc('match_documentos_hibrido', {
      query_embedding: queryEmbedding,
      query_text: mensagem,
      match_count: 5,
      alpha: 0.5
    });

    if (error) {
      console.error('Erro na busca híbrida:', error);
      return [];
    }

    console.log(`📚 Encontrados ${data?.length || 0} documentos relevantes`);
    return data || [];

  } catch (error) {
    console.error('Erro ao buscar documentos:', error);
    return [];
  }
}

async function corrigirRespostaComConhecimento(mensagem: string, documentos: any[]) {
  if (!openaiApiKey) {
    console.log('⚠️ OpenAI API key não configurada, retornando mensagem original');
    return mensagem;
  }

  try {
    // Preparar contexto dos documentos
    const contexto = documentos.length > 0 
      ? documentos.map(doc => `**${doc.titulo}**\n${doc.conteudo?.texto || doc.conteudo || 'Sem conteúdo'}`).join('\n\n---\n\n')
      : 'Nenhum documento relevante encontrado na base de conhecimento.';

    console.log(`🧠 Usando modelo GPT-4o-mini com ${documentos.length} documentos de contexto`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em atendimento ao cliente da Cresci & Perdi. 

IMPORTANTE: Você deve corrigir e padronizar a resposta do atendente seguindo estas regras:

🔧 CORREÇÃO E PADRONIZAÇÃO:
1. Corrija português (ortografia, gramática, concordância)
2. Use tom educado, profissional e acolhedor
3. Mantenha o conteúdo essencial da resposta
4. Torne a resposta mais clara, completa e detalhada
5. Use linguagem institucional consistente

📚 VALIDAÇÃO COM BASE DE CONHECIMENTO:
- Se houver informações na base de conhecimento relacionadas à resposta, SEMPRE priorize e use essas informações oficiais
- Se a resposta do atendente contradizer a base de conhecimento, corrija usando as informações oficiais
- Se não houver informações relevantes na base, apenas faça a correção de forma e tom
- NUNCA invente informações que não estão na base de conhecimento

📋 FORMATO DE SAÍDA:
Retorne apenas a versão corrigida e padronizada da resposta, sem explicações adicionais.`
          },
          {
            role: 'user',
            content: `BASE DE CONHECIMENTO:
${contexto}

RESPOSTA DO ATENDENTE PARA CORRIGIR:
${mensagem}

Corrija e padronize esta resposta usando as informações da base de conhecimento quando relevante:`
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      })
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

async function avaliarParaDocumentacao(respostaCorrigida: string) {
  if (!openaiApiKey) {
    return {
      pode_documentar: false,
      classificacao: "Não",
      resultado: "OpenAI API key não configurada"
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
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
    console.log('🚀 Iniciando process-response com busca semântica');
    
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

    // 1. Buscar documentos relacionados na base de conhecimento
    console.log('📚 Buscando documentos na base de conhecimento...');
    const documentosRelacionados = await buscarDocumentosRelacionados(mensagem);

    // 2. Corrigir resposta usando a base de conhecimento
    console.log('🔄 Corrigindo resposta com base de conhecimento...');
    const respostaCorrigida = await corrigirRespostaComConhecimento(mensagem, documentosRelacionados);
    console.log('✅ Resposta corrigida');

    // 3. Avaliar se pode ser documentação
    console.log('📋 Avaliando para documentação...');
    const avaliacao = await avaliarParaDocumentacao(respostaCorrigida);
    console.log('📝 Avaliação:', avaliacao.classificacao);

    // 4. Se pode ser documentação, salvar para aprovação
    if (avaliacao.pode_documentar) {
      console.log('💾 Salvando para aprovação automática...');
      try {
        const { data: aprovacao, error } = await supabase
          .from('knowledge_auto_approvals')
          .insert({
            original_message: mensagem,
            corrected_response: respostaCorrigida,
            documentation_content: avaliacao.resultado,
            similar_documents: documentosRelacionados,
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

    console.log('✅ Processamento concluído com sucesso');

    return new Response(JSON.stringify({
      success: true,
      resposta_corrigida: respostaCorrigida,
      avaliacao_documentacao: avaliacao,
      documentos_encontrados: documentosRelacionados.length,
      pode_virar_documento: avaliacao.pode_documentar
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
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