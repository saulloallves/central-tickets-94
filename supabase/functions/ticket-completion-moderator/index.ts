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

async function openAI(path: string, payload: any, tries = 3) {
  let wait = 300;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) return r;
    if (r.status === 429 || r.status === 503) { 
      await new Promise(res => setTimeout(res, wait)); 
      wait *= 2; 
      continue; 
    }
    throw new Error(`${path} error: ${await r.text()}`);
  }
  throw new Error(`${path} error: too many retries`);
}

async function encontrarDocumentosRelacionados(textoMensagem: string, limiteResultados: number = 12) {
  try {
    console.log('🔍 Gerando embedding para:', textoMensagem.substring(0, 100) + '...');
    
    const embeddingResponse = await openAI('embeddings', {
      model: 'text-embedding-3-small',
      input: textoMensagem
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Embedding API error: ${await embeddingResponse.text()}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('🔎 Executando busca híbrida...');
    
    const { data: candidatos, error } = await supabase.rpc('match_documentos_hibrido', {
      query_embedding: queryEmbedding,
      query_text: textoMensagem,
      match_count: limiteResultados,
      alpha: 0.5
    });

    if (error) {
      console.error('Erro na busca híbrida:', error);
      return [];
    }

    console.log(`🔎 Busca híbrida → ${candidatos?.length || 0} candidatos`);
    return candidatos || [];
    
  } catch (error) {
    console.error('Erro ao buscar documentos relacionados:', error);
    return [];
  }
}

async function moderarTexto(conversa: string, problema: string) {
  if (!openaiApiKey) {
    return {
      classificacao: "Não",
      resultado: "OpenAI API key não configurada"
    };
  }

  try {
    const response = await openAI('chat/completions', {
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em documentação da Cresci & Perdi.

TAREFA: Transformar conversas de atendimento em documentação estruturada.

PROCESSO:
1. Analise a conversa entre franqueado e suporte
2. Extraia a solução/procedimento fornecido pelo suporte
3. Transforme em um documento objetivo e prático
4. Avalie se é adequado para documentação oficial

FORMATO DE SAÍDA - JSON:
{
  "classificacao": "Sim" | "Não",
  "resultado": "documento estruturado OU motivo da rejeição"
}

CRITÉRIOS PARA APROVAÇÃO ("Sim"):
- A resposta do suporte contém instruções claras e específicas
- É aplicável a situações similares futuras
- Fornece um procedimento completo
- Não contém conversas subjetivas ou dúvidas do atendente

CRITÉRIOS PARA REJEIÇÃO ("Não"):
- Resposta muito genérica ("entre em contato", "vou verificar")
- Conversas com dúvidas ou incertezas
- Apenas redirecionamentos sem solução
- Informações incompletas

FORMATO DO DOCUMENTO (se aprovado):
- Use linguagem direta e objetiva
- Remova referências pessoais ("você", "eu", conversas)
- Organize em passos lógicos se necessário
- Foque nas instruções práticas

EXEMPLO:
Conversa: "[FRANQUEADO]: como categorizo uma calça jeans sem marca?
[SUPORTE]: Para prosseguir corretamente, é necessário seguir por níveis, avançando etapa a etapa..."

Documento: "Para categorizar uma calça jeans sem marca: 1) Seguir por níveis, avançando etapa a etapa. 2) Verificar em cada nível para garantir que tudo ocorra conforme o esperado..."`
        },
        {
          role: 'user',
          content: `PROBLEMA/PERGUNTA:
${problema}

CONVERSA DE ATENDIMENTO:
${conversa}

Transforme esta conversa em documentação estruturada:`
        }
      ],
      max_completion_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Erro na moderação:', error);
    return {
      classificacao: "Não",
      resultado: "Erro na análise de moderação"
    };
  }
}

async function analisarSimilaridade(documentacaoFormatada: string) {
  try {
    // 1. Buscar documentos similares
    const documentosSimilares = await encontrarDocumentosRelacionados(documentacaoFormatada, 5);
    
    // 2. Gerar análise comparativa se houver documentos similares
    let analiseComparativa = '';
    if (documentosSimilares.length > 0) {
      console.log('📊 Gerando análise comparativa...');
      
      const contextoDocs = documentosSimilares.map(doc => 
        `**${doc.titulo}** (ID: ${doc.id})\nConteúdo: ${typeof doc.conteudo === 'string' ? doc.conteudo : JSON.stringify(doc.conteudo)}`
      ).join('\n\n---\n\n');

      const response = await openAI('chat/completions', {
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em análise de documentação. Compare o novo texto com os documentos existentes e forneça uma análise detalhada.

TAREFAS:
1. Identifique se há sobreposição de conteúdo
2. Determine se o novo texto:
   - É completamente novo (sem similaridade)
   - Complementa documentos existentes
   - Duplica informações já presentes
   - Atualiza/corrige informações existentes
3. Sugira a melhor ação: criar novo documento OU atualizar documento existente

Formate sua resposta como uma análise detalhada para decisão de aprovação.`
          },
          {
            role: 'user',
            content: `NOVO TEXTO PARA DOCUMENTAÇÃO:
${documentacaoFormatada}

DOCUMENTOS SIMILARES EXISTENTES:
${contextoDocs}

Analise a similaridade e forneça recomendações:`
          }
        ],
        max_completion_tokens: 800
      });

      if (response.ok) {
        const data = await response.json();
        analiseComparativa = data.choices[0].message.content;
      }
    }

    return {
      documentos_similares: documentosSimilares,
      analise_comparativa: analiseComparativa
    };
    
  } catch (error) {
    console.error('Erro na análise de similaridade:', error);
    return {
      documentos_similares: [],
      analise_comparativa: 'Erro ao gerar análise comparativa'
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando moderação de ticket concluído');
    
    const body = await req.json();
    const { ticket_id, conversa, problema, usuario_id, approval_id } = body;
    
    console.log('📝 Dados recebidos:', { 
      ticket_id, 
      usuario_id, 
      approval_id,
      conversa_length: conversa?.length || 0,
      problema_length: problema?.length || 0
    });

    if (!ticket_id || !conversa || !problema) {
      console.error('❌ Dados obrigatórios ausentes');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Dados obrigatórios ausentes (ticket_id, conversa, problema)' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Moderar o texto para ver se pode virar documentação
    console.log('🔍 Moderando texto para documentação...');
    const moderacao = await moderarTexto(conversa, problema);
    console.log('📝 Resultado da moderação:', moderacao.classificacao);

    // 2. Se passou na moderação, analisar similaridade
    let analise = { documentos_similares: [], analise_comparativa: '' };
    
    if (moderacao.classificacao === 'Sim') {
      console.log('✅ Texto aprovado pela moderação, analisando similaridade...');
      analise = await analisarSimilaridade(moderacao.resultado);
      console.log(`📊 Encontrados ${analise.documentos_similares.length} documentos similares`);
    }

    // 3. Atualizar a entrada existente (se approval_id foi passado) ou criar nova
    if (approval_id) {
      console.log('🔄 Atualizando entrada existente...');
      const { error: updateError } = await supabase
        .from('knowledge_auto_approvals')
        .update({
          corrected_response: moderacao.resultado,
          documentation_content: moderacao.classificacao === 'Sim' ? moderacao.resultado : '',
          similar_documents: analise.documentos_similares,
          comparative_analysis: analise.analise_comparativa,
          status: moderacao.classificacao === 'Sim' ? 'approved' : 'rejected',
          decision_reason: moderacao.classificacao === 'Sim' ? 'Aprovado pela IA - adequado para documentação' : moderacao.resultado,
          ai_evaluation: {
            moderacao: moderacao,
            similaridade_analisada: moderacao.classificacao === 'Sim',
            documentos_similares_count: analise.documentos_similares.length
          }
        })
        .eq('id', approval_id);

      if (updateError) {
        console.error('❌ Erro ao atualizar aprovação:', updateError);
      } else {
        console.log('✅ Aprovação atualizada com sucesso');
      }
    } else {
      // Fallback: criar nova entrada se não tiver approval_id
      if (moderacao.classificacao === 'Sim') {
        console.log('💾 Criando nova entrada para aprovação...');
        try {
          const { data: aprovacao, error } = await supabase
            .from('knowledge_auto_approvals')
            .insert({
              original_message: `${problema}\n\n${conversa}`,
              corrected_response: moderacao.resultado,
              documentation_content: moderacao.resultado,
              similar_documents: analise.documentos_similares,
              comparative_analysis: analise.analise_comparativa,
              ticket_id,
              created_by: usuario_id,
              status: 'approved',
              decision_reason: 'Aprovado pela IA - adequado para documentação',
              ai_evaluation: {
                moderacao: moderacao,
                similaridade_analisada: true,
                documentos_similares_count: analise.documentos_similares.length
              }
            })
            .select()
            .single();

          if (error) {
            console.error('❌ Erro ao salvar aprovação:', error);
          } else {
            console.log('💾 Aprovação salva com ID:', aprovacao.id);
          }
        } catch (error) {
          console.error('❌ Erro ao processar aprovação:', error);
        }
      } else {
        console.log('❌ Texto rejeitado pela moderação, não criando entrada');
      }
    }

    console.log('✅ Moderação concluída com sucesso');

    return new Response(JSON.stringify({
      success: true,
      moderacao: moderacao,
      pode_virar_documentacao: moderacao.classificacao === 'Sim',
      documentos_similares_encontrados: analise.documentos_similares.length,
      analise_similaridade: analise.analise_comparativa
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na moderação:', error);
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