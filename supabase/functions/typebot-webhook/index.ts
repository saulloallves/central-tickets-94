import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookToken = Deno.env.get('TYPEBOT_WEBHOOK_TOKEN');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Função para extrair termos de busca do texto
function extractSearchTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 3)
    .slice(0, 10);
}

// Módulo de resposta por Knowledge Base
async function searchKnowledgeBase(message: string) {
  console.log('Searching knowledge base for:', message);
  
  const searchTerms = extractSearchTerms(message);
  console.log('Search terms:', searchTerms);

  if (searchTerms.length === 0) {
    return { hasAnswer: false, articles: [] };
  }

  // Buscar artigos relevantes na base de conhecimento
  const { data: articles, error } = await supabase
    .from('knowledge_articles')
    .select('id, titulo, conteudo, categoria, tags')
    .eq('ativo', true)
    .eq('aprovado', true)
    .eq('usado_pela_ia', true);

  if (error) {
    console.error('Error fetching KB articles:', error);
    return { hasAnswer: false, articles: [] };
  }

  // Filtrar artigos que contenham os termos de busca
  const relevantArticles = articles?.filter(article => {
    const searchText = `${article.titulo} ${article.conteudo} ${article.categoria} ${article.tags?.join(' ') || ''}`.toLowerCase();
    return searchTerms.some(term => searchText.includes(term));
  }) || [];

  console.log(`Found ${relevantArticles.length} relevant articles`);

  // Se temos artigos relevantes, tentar gerar resposta com OpenAI
  if (relevantArticles.length > 0 && openaiApiKey) {
    const knowledgeContext = relevantArticles
      .map(article => `**${article.titulo}**\n${article.conteudo}`)
      .join('\n\n---\n\n');

    try {
      // Get AI settings for knowledge base query
      const { data: aiSettings } = await supabase
        .from('faq_ai_settings')
        .select('*')
        .eq('ativo', true)
        .maybeSingle();

      const modelToUse = aiSettings?.modelo_chat || 'gpt-4.1-2025-04-14';
      const apiProvider = aiSettings?.api_provider || 'openai';
      
      let apiUrl = 'https://api.openai.com/v1/chat/completions';
      let authToken = openaiApiKey;
      
      if (apiProvider === 'lambda' && aiSettings?.api_base_url) {
        apiUrl = `${aiSettings.api_base_url}/chat/completions`;
        authToken = aiSettings.api_key || openaiApiKey;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            {
              role: 'system',
              content: `Você é um assistente de suporte técnico. Use APENAS as informações fornecidas na base de conhecimento para responder. Se a informação não estiver disponível na base de conhecimento, responda "Não encontrei informações suficientes na base de conhecimento para responder essa pergunta."

Base de Conhecimento:
${knowledgeContext}`
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_completion_tokens: 500,
        }),
      });

      const aiResponse = await response.json();
      const answer = aiResponse.choices?.[0]?.message?.content;

      if (answer && !answer.includes('Não encontrei informações suficientes')) {
        return {
          hasAnswer: true,
          answer,
          sources: relevantArticles.map(a => ({ id: a.id, titulo: a.titulo }))
        };
      }
    } catch (error) {
      console.error('Error calling OpenAI:', error);
    }
  }

  return { hasAnswer: false, articles: relevantArticles };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Typebot webhook called');
    
    // Validar token via header X-Webhook-Token
    if (webhookToken) {
      const providedToken = req.headers.get('x-webhook-token');
      
      if (providedToken !== webhookToken) {
        console.log('Invalid webhook token');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const body = await req.json();
    console.log('Received data from Typebot:', JSON.stringify(body, null, 2));

    const {
      message,
      codigo_unidade,
      user: { web_password } = {},
      attachments,
      category_hint,
      force_create = false,
      metadata
    } = body;

    // Validar dados obrigatórios
    if (!message) {
      return new Response(JSON.stringify({ 
        error: 'Campo "message" é obrigatório',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!codigo_unidade) {
      return new Response(JSON.stringify({ 
        error: 'Campo "codigo_unidade" é obrigatório',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar o ID da unidade pelo código de 4 dígitos
    const { data: unidade, error: unidadeError } = await supabase
      .from('unidades')
      .select('id')
      .eq('codigo_grupo', codigo_unidade)
      .single();

    if (unidadeError || !unidade) {
      console.error('Unidade não encontrada:', codigo_unidade);
      return new Response(JSON.stringify({ 
        error: 'Código da unidade não encontrado',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar franqueado pela senha web se fornecida
    let franqueadoId = null;
    if (web_password) {
      const { data: franqueado } = await supabase
        .from('franqueados')
        .select('id')
        .eq('web_password', parseInt(web_password))
        .maybeSingle();
      
      if (franqueado) {
        franqueadoId = franqueado.id;
        console.log('Franqueado encontrado:', franqueado.id);
      } else {
        console.log('Franqueado não encontrado para senha web:', web_password);
      }
    }

    // Primeiro, tentar responder pela base de conhecimento (se não forçar criação)
    if (!force_create) {
      const kbResult = await searchKnowledgeBase(message);
      
      if (kbResult.hasAnswer) {
        console.log('Answer found in knowledge base');
        return new Response(JSON.stringify({
          action: 'answer',
          success: true,
          answer: kbResult.answer,
          sources: kbResult.sources,
          message: 'Resposta encontrada na base de conhecimento'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Se não encontrou resposta na KB ou forçou criação, criar ticket
    console.log('Creating ticket - no suitable KB answer found');

    // Buscar equipes ativas para análise
    const { data: equipes, error: equipesError } = await supabase
      .from('equipes')
      .select('id, nome, introducao, descricao')
      .eq('ativo', true);

    if (equipesError) {
      console.error('Error fetching teams:', equipesError);
    }

    let analysisResult = null;
    let equipeResponsavelId = null;
    let modelToUse = 'gpt-4.1-2025-04-14'; // Updated to newer model
    let apiProvider = 'openai'; // Default fallback

    // Análise por IA se temos OpenAI e equipes
    if (openaiApiKey && equipes && equipes.length > 0) {
      try {
        console.log('Starting AI classification...');
        console.log('Available teams:', equipes.map(eq => `${eq.nome} (${eq.id})`));
        
        const equipesInfo = equipes.map(eq => 
          `- ID: ${eq.id} | Nome: ${eq.nome} | Descrição: ${eq.introducao} - ${eq.descricao}`
        ).join('\n');

        // Get AI settings for classification  
        const { data: aiSettings } = await supabase
          .from('faq_ai_settings')
          .select('*')
          .eq('ativo', true)
          .maybeSingle();

        modelToUse = aiSettings?.modelo_classificacao || 'gpt-4.1-2025-04-14';
        apiProvider = aiSettings?.api_provider || 'openai';
        
        console.log('Using model:', modelToUse, 'Provider:', apiProvider);
        
        let apiUrl = 'https://api.openai.com/v1/chat/completions';
        let authToken = openaiApiKey;
        
        if (apiProvider === 'lambda' && aiSettings?.api_base_url) {
          apiUrl = `${aiSettings.api_base_url}/chat/completions`;
          authToken = aiSettings.api_key || openaiApiKey;
          console.log('Using Lambda API:', apiUrl);
        } else {
          console.log('Using OpenAI API:', apiUrl);
        }

        const requestBody = {
          model: modelToUse,
          messages: [
            {
              role: 'system',
              content: `Você é um classificador especializado em tickets de suporte de franquia. Sua única função é analisar a mensagem e retornar APENAS um JSON válido seguindo EXATAMENTE este formato:

{
  "prioridade": "imediato|ate_1_hora|ainda_hoje|posso_esperar",
  "categoria": "juridico|sistema|midia|operacoes|rh|financeiro|outro",
  "subcategoria": "string ou null",
  "is_crise": boolean,
  "motivo_crise": "string ou null",
  "sla_sugerido_horas": number,
  "equipe_responsavel": "nome_da_equipe"
}

REGRAS OBRIGATÓRIAS:
- RETORNE APENAS O JSON, sem texto adicional
- NUNCA deixe categoria como null - sempre escolha uma das opções disponíveis
- NUNCA deixe equipe_responsavel como null - sempre escolha uma equipe da lista
- Se não souber a categoria exata, use "outro"
- Se não souber a equipe exata, use a primeira da lista
- prioridade IMEDIATO: problemas críticos que impedem funcionamento (15min)
- prioridade ATE_1_HORA: problemas urgentes que afetam produtividade (1h) 
- prioridade AINDA_HOJE: problemas importantes mas não bloqueiam trabalho (até 18h)
- prioridade POSSO_ESPERAR: dúvidas, solicitações, problemas menores (24h)
- is_crise = true APENAS para casos EXTREMAMENTE críticos que paralisam operação
- motivo_crise APENAS se is_crise = true
- equipe_responsavel deve ser o NOME EXATO de uma das equipes disponíveis

CATEGORIAS VÁLIDAS:
- juridico: questões legais, contratos, processos, documentação legal
- sistema: problemas técnicos, travamentos, erros de sistema, apps
- midia: marketing, redes sociais, materiais promocionais, comunicação
- operacoes: processos operacionais, logística, funcionamento da franquia
- rh: recursos humanos, contratação, folha de pagamento, benefícios
- financeiro: questões financeiras, pagamentos, cobrança, contabilidade
- outro: quando não se encaixa nas categorias acima

EQUIPES DISPONÍVEIS:
${equipesInfo}

EXEMPLO DE RESPOSTA VÁLIDA:
{
  "prioridade": "posso_esperar",
  "categoria": "midia",
  "subcategoria": "material promocional",
  "is_crise": false,
  "motivo_crise": null,
  "sla_sugerido_horas": 24,
  "equipe_responsavel": "Mídia"
}

Analise o conteúdo e classifique adequadamente:`
            },
            {
              role: 'user',
              content: `Mensagem: ${message}\nCategoria sugerida: ${category_hint || 'não informada'}`
            }
          ]
        };

        // Add appropriate parameters based on model type
        if (modelToUse.includes('gpt-4.1') || modelToUse.includes('gpt-5') || modelToUse.includes('o3') || modelToUse.includes('o4')) {
          // Newer models use max_completion_tokens and don't support temperature
          requestBody.max_completion_tokens = 300;
        } else {
          // Legacy models use max_tokens and support temperature
          requestBody.max_tokens = 300;
          requestBody.temperature = 0.1;
        }

        console.log('Sending request to AI with body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        console.log('AI API Response status:', response.status);
        console.log('AI API Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('AI API Error:', errorText);
          throw new Error(`AI API Error: ${response.status} - ${errorText}`);
        }

        const aiResponse = await response.json();
        console.log('Raw AI response:', JSON.stringify(aiResponse, null, 2));
        
        const analysis = aiResponse.choices?.[0]?.message?.content;
        console.log('AI analysis content:', analysis);
        
        if (analysis) {
          try {
            // Clean response - remove markdown backticks if present
            let cleanedAnalysis = analysis.trim();
            if (analysis.includes('```json')) {
              cleanedAnalysis = analysis.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
            } else if (analysis.includes('```')) {
              cleanedAnalysis = analysis.replace(/```\s*/g, '').trim();
            }
            
            console.log('Cleaned analysis for parsing:', cleanedAnalysis);
            analysisResult = JSON.parse(cleanedAnalysis);
            console.log('Parsed AI analysis result:', JSON.stringify(analysisResult, null, 2));
            
            // Encontrar equipe por nome
            if (analysisResult.equipe_responsavel) {
              console.log('Looking for team with name:', analysisResult.equipe_responsavel);
              const equipeEncontrada = equipes.find(eq => 
                eq.nome.toLowerCase().trim() === analysisResult.equipe_responsavel.toLowerCase().trim()
              );
              if (equipeEncontrada) {
                equipeResponsavelId = equipeEncontrada.id;
                console.log('Team matched:', equipeEncontrada.nome, '-> ID:', equipeResponsavelId);
              } else {
                console.log('Team not found:', analysisResult.equipe_responsavel);
                console.log('Available teams:', equipes.map(eq => eq.nome));
              }
            } else {
              console.log('No team specified in AI response');
            }
          } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            console.log('Raw AI response that failed to parse:', analysis);
          }
        } else {
          console.error('No analysis content returned from AI');
        }
      } catch (error) {
        console.error('Error in AI classification:', error);
      }
    } else {
      console.log('Skipping AI analysis - missing requirements:', {
        hasOpenAI: !!openaiApiKey,
        hasEquipes: !!(equipes && equipes.length > 0),
        equipesCount: equipes?.length || 0
      });
    }

    // Aplicar fallbacks se a análise falhou ou retornou null
    if (!analysisResult || !analysisResult.categoria || !analysisResult.equipe_responsavel) {
      console.log('AI analysis incomplete, applying fallbacks...');
      
      // Fallback inteligente baseado na mensagem
      const messageWords = message.toLowerCase();
      let fallbackCategoria = 'outro';
      let fallbackEquipeId = equipes?.[0]?.id || null;
      
      // Detecção de categoria por palavras-chave
      if (messageWords.includes('sistema') || messageWords.includes('app') || messageWords.includes('erro') || messageWords.includes('travou')) {
        fallbackCategoria = 'sistema';
      } else if (messageWords.includes('midia') || messageWords.includes('marketing') || messageWords.includes('propaganda')) {
        fallbackCategoria = 'midia';
      } else if (messageWords.includes('juridico') || messageWords.includes('contrato') || messageWords.includes('legal')) {
        fallbackCategoria = 'juridico';
      } else if (messageWords.includes('rh') || messageWords.includes('funcionario') || messageWords.includes('folha')) {
        fallbackCategoria = 'rh';
      } else if (messageWords.includes('financeiro') || messageWords.includes('pagamento') || messageWords.includes('dinheiro')) {
        fallbackCategoria = 'financeiro';
      }
      
      // Buscar equipe compatível com a categoria
      const equipeCompativel = equipes?.find(eq => 
        eq.nome.toLowerCase().includes(fallbackCategoria) || 
        eq.introducao?.toLowerCase().includes(fallbackCategoria) ||
        eq.descricao?.toLowerCase().includes(fallbackCategoria)
      );
      
      if (equipeCompativel) {
        fallbackEquipeId = equipeCompativel.id;
      }
      
      // Aplicar fallbacks no resultado da análise
      if (!analysisResult) {
        analysisResult = {};
      }
      analysisResult.categoria = analysisResult.categoria || fallbackCategoria;
      analysisResult.prioridade = analysisResult.prioridade || 'posso_esperar';
      analysisResult.sla_sugerido_horas = analysisResult.sla_sugerido_horas || 24;
      analysisResult.is_crise = analysisResult.is_crise || false;
      
      if (!equipeResponsavelId) {
        equipeResponsavelId = fallbackEquipeId;
      }
      
      console.log('Applied fallbacks:', {
        categoria: analysisResult.categoria,
        equipe_id: equipeResponsavelId,
        prioridade: analysisResult.prioridade
      });
    }

    // Criar ticket com dados da análise ou defaults
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        unidade_id: unidade.id,
        franqueado_id: franqueadoId,
        descricao_problema: message,
        categoria: analysisResult?.categoria || 'outro',
        subcategoria: analysisResult?.subcategoria || null,
        prioridade: analysisResult?.prioridade || 'posso_esperar',
        equipe_responsavel_id: equipeResponsavelId || equipes?.[0]?.id,
        canal_origem: 'typebot',
        status: analysisResult?.is_crise ? 'escalonado' : 'aberto',
        escalonamento_nivel: analysisResult?.is_crise ? 5 : 0,
        data_abertura: new Date().toISOString(),
        arquivos: attachments || [],
        log_ia: analysisResult ? {
          analysis: analysisResult,
          model: modelToUse,
          api_provider: apiProvider,
          timestamp: new Date().toISOString()
        } : {}
      })
      .select()
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', ticketError);
      return new Response(JSON.stringify({ 
        error: 'Erro ao criar ticket',
        details: ticketError.message,
        success: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Inserir primeira mensagem do usuário
    await supabase
      .from('ticket_mensagens')
      .insert({
        ticket_id: ticket.id,
        mensagem: message,
        direcao: 'entrada',
        canal: 'typebot',
        anexos: attachments || []
      });

    // Não adicionar informações do franqueado nas conversas
    // Os dados já estão vinculados no campo franqueado_id do ticket

    // Análise já foi feita durante a criação, não precisamos chamar analyze-ticket
    console.log('Ticket created with AI analysis during creation');

    // Buscar dados atualizados do ticket após análise
    const { data: updatedTicket } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket.id)
      .single();

    const finalTicket = updatedTicket || ticket;

    console.log('Ticket created successfully:', finalTicket.codigo_ticket);

    // Resposta de sucesso com análise da IA
    return new Response(JSON.stringify({
      statusCode: 200,
      data: {
        action: 'ticket_created',
        success: true,
        ticket_id: finalTicket.id,
        codigo_ticket: finalTicket.codigo_ticket,
        status: finalTicket.status,
        categoria: finalTicket.categoria,
        subcategoria: finalTicket.subcategoria,
        prioridade: finalTicket.prioridade,
        data_limite_sla: finalTicket.data_limite_sla,
        message: `Ticket ${finalTicket.codigo_ticket} criado com sucesso!`,
        metadata: {
          ai_analysis_completed: !!finalTicket.log_ia,
          equipe_responsavel_id: finalTicket.equipe_responsavel_id,
          is_crise: finalTicket.log_ia?.analysis?.is_crise || false,
          sla_sugerido_horas: finalTicket.log_ia?.analysis?.sla_sugerido_horas || 24,
          analysis_model: modelToUse
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in typebot webhook:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro interno do servidor',
      details: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});