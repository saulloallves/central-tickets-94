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
    console.log('🚀 === TYPEBOT WEBHOOK CALLED ===');
    console.log('📨 Method:', req.method);
    console.log('📨 Headers:', Object.fromEntries(req.headers.entries()));
    console.log('📨 URL:', req.url);
    
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

    // Buscar equipes ativas para análise (com introdução - especialidades)
    const { data: equipes, error: equipesError } = await supabase
      .from('equipes')
      .select('id, nome, introducao')
      .eq('ativo', true)
      .order('nome');

    if (equipesError) {
      console.error('Error fetching teams:', equipesError);
    }

    console.log('Equipes encontradas para análise:', JSON.stringify(equipes, null, 2));

    let analysisResult = null;
    let equipeResponsavelId = null;
    let modelToUse = 'gpt-5-2025-08-07'; // Use latest model
    let apiProvider = 'openai'; // Default fallback
    let titulo = null;

    // Sistema de análise completa usando lógica do analyze-ticket
    if (openaiApiKey && equipes && equipes.length > 0) {
      try {
        console.log('Iniciando análise IA completa...');
        
        // Buscar configurações da IA
        const { data: aiSettings } = await supabase
          .from('faq_ai_settings')
          .select('*')
          .eq('ativo', true)
          .maybeSingle();

        modelToUse = aiSettings?.modelo_classificacao || 'gpt-5-2025-08-07';
        apiProvider = aiSettings?.api_provider || 'openai';
        
        let apiUrl = 'https://api.openai.com/v1/chat/completions';
        let authToken = openaiApiKey;
        let apiHeaders = {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        };
        
        if (apiProvider === 'lambda' && aiSettings?.api_base_url) {
          apiUrl = `${aiSettings.api_base_url}/chat/completions`;
          authToken = aiSettings.api_key || openaiApiKey;
          apiHeaders.Authorization = `Bearer ${authToken}`;
          
          // Add custom headers if configured
          if (aiSettings.custom_headers && typeof aiSettings.custom_headers === 'object') {
            Object.assign(apiHeaders, aiSettings.custom_headers);
          }
        }

        const equipesDisponiveis = equipes?.map(e => `- ${e.nome}: ${e.introducao || 'Sem especialidades definidas'}`).join('\n') || 'Nenhuma equipe disponível';

        console.log('Prompt que será enviado para a IA:', equipesDisponiveis);

        // Prompt melhorado igual ao analyze-ticket
        const analysisPrompt = `
Você é um especialista em classificação de tickets de suporte técnico da Cresci & Perdi.

Analise este ticket e forneça:

1. TÍTULO: Crie um título DESCRITIVO de exatamente 3 palavras que resuma o OBJETIVO/PROBLEMA principal.
   - NÃO copie as primeiras palavras da descrição
   - Seja criativo e descritivo
   - Exemplos: "Problema áudio Zoom", "Solicitar materiais gráficos", "Criação mídia planfetos"

2. CATEGORIA: juridico, sistema, midia, operacoes, rh, financeiro, outro

3. PRIORIDADE (OBRIGATÓRIO escolher uma): imediato, ate_1_hora, ainda_hoje, posso_esperar
   - imediato: problemas críticos que impedem funcionamento
   - ate_1_hora: problemas urgentes que afetam produtividade  
   - ainda_hoje: problemas importantes mas não bloqueiam trabalho
   - posso_esperar: dúvidas, solicitações, problemas menores

4. EQUIPE_SUGERIDA: Analise cuidadosamente qual equipe deve atender baseado nas ESPECIALIDADES de cada equipe:

EQUIPES E SUAS ESPECIALIDADES:
${equipesDisponiveis}

INSTRUÇÕES PARA DESIGNAÇÃO DE EQUIPE:
- Leia atentamente as ESPECIALIDADES de cada equipe listadas acima
- Escolha a equipe cuja especialidade melhor corresponde ao problema descrito
- Use o nome EXATO da equipe como aparece na lista
- Se nenhuma equipe se adequar perfeitamente, retorne null

Descrição do problema: "${message}"

Responda APENAS em formato JSON válido:
{
  "titulo": "Título Descritivo Criativo",
  "categoria": "categoria_sugerida", 
  "prioridade": "imediato_ou_ate_1_hora_ou_ainda_hoje_ou_posso_esperar",
  "equipe_sugerida": "nome_exato_da_equipe_ou_null",
  "justificativa": "Breve explicação da análise e por que escolheu esta equipe"
}

CRÍTICO: Use APENAS estas 4 prioridades: imediato, ate_1_hora, ainda_hoje, posso_esperar
`;

        // Determine API parameters based on model
        const isNewerOpenAIModel = modelToUse.includes('gpt-4.1') || modelToUse.includes('gpt-5') || modelToUse.includes('o3') || modelToUse.includes('o4');
        
        const requestBody = {
          model: modelToUse,
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em classificação de tickets de suporte técnico. Analise sempre em português brasileiro e seja preciso nas classificações.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ]
        };

        // Set parameters based on provider and model
        if (apiProvider === 'lambda') {
          // Lambda API supports temperature and max_tokens
          requestBody.temperature = aiSettings?.temperatura_classificacao || 0.1;
          requestBody.max_tokens = aiSettings?.max_tokens_classificacao || 500;
          requestBody.top_p = 1.0;
          requestBody.frequency_penalty = 0;
          requestBody.presence_penalty = 0;
        } else if (isNewerOpenAIModel) {
          // Newer OpenAI models use max_completion_tokens and don't support temperature
          requestBody.max_completion_tokens = aiSettings?.max_tokens_classificacao || 500;
          requestBody.frequency_penalty = 0;
          requestBody.presence_penalty = 0;
        } else {
          // Legacy OpenAI models
          requestBody.max_tokens = aiSettings?.max_tokens_classificacao || 500;
          requestBody.temperature = aiSettings?.temperatura_classificacao || 0.1;
          requestBody.top_p = 1.0;
          requestBody.frequency_penalty = 0;
          requestBody.presence_penalty = 0;
        }

        console.log('Calling AI API with provider:', apiProvider, 'model:', modelToUse);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const aiResponse = await response.json();
          const analysis = aiResponse.choices?.[0]?.message?.content;
          
          console.log('AI response:', analysis);
          
          if (analysis) {
            try {
              let cleanedAnalysis = analysis.trim();
              if (analysis.includes('```json')) {
                cleanedAnalysis = analysis.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
              } else if (analysis.includes('```')) {
                cleanedAnalysis = analysis.replace(/```\s*/g, '').trim();
              }
              
              const aiResult = JSON.parse(cleanedAnalysis);
              console.log('IA retornou:', aiResult);
              
              // Validar e corrigir prioridade
              const validPriorities = ['imediato', 'ate_1_hora', 'ainda_hoje', 'posso_esperar'];
              if (!validPriorities.includes(aiResult.prioridade)) {
                console.log(`❌ INVALID PRIORITY: AI suggested "${aiResult.prioridade}", mapping to valid priority`);
                // Mapear prioridades antigas para novas se necessário
                switch (aiResult.prioridade) {
                  case 'urgente':
                  case 'urgente':
                    aiResult.prioridade = 'imediato';
                    break;
                  case 'alta':
                    aiResult.prioridade = 'ate_1_hora';
                    break;
                  case 'hoje_18h':
                    aiResult.prioridade = 'ainda_hoje';
                    break;
                  case 'padrao_24h':
                  default:
                    aiResult.prioridade = 'posso_esperar';
                    break;
                }
              }

              // Garantir que o título tenha no máximo 3 palavras
              if (aiResult.titulo) {
                const cleanTitle = aiResult.titulo.trim().replace(/[.,!?;:"']+/g, '');
                const words = cleanTitle.split(/\s+/).filter(word => word.length > 0);
                titulo = words.slice(0, 3).join(' ');
              }

              // Buscar equipe por nome exato se foi sugerida
              if (aiResult.equipe_sugerida) {
                console.log('Procurando equipe:', aiResult.equipe_sugerida);
                
                // Primeiro, tentar match exato
                let equipeEncontrada = equipes.find(eq => eq.nome === aiResult.equipe_sugerida);
                
                // Se não encontrar match exato, tentar busca similar
                if (!equipeEncontrada) {
                  equipeEncontrada = equipes.find(eq => 
                    eq.nome.toLowerCase().includes(aiResult.equipe_sugerida.toLowerCase())
                  );
                }
                
                if (equipeEncontrada) {
                  equipeResponsavelId = equipeEncontrada.id;
                  console.log(`Equipe encontrada: ${equipeEncontrada.nome} (ID: ${equipeEncontrada.id})`);
                } else {
                  console.log('Nenhuma equipe encontrada para:', aiResult.equipe_sugerida);
                }
              }
              
              analysisResult = {
                categoria: aiResult.categoria || 'outro',
                prioridade: aiResult.prioridade || 'posso_esperar',
                titulo: titulo || 'Novo Ticket',
                equipe_responsavel: aiResult.equipe_sugerida,
                justificativa: aiResult.justificativa || 'Análise automática'
              };
              
              console.log('Classificação final da IA:', analysisResult);
              
            } catch (parseError) {
              console.error('Erro ao parsear resposta da IA:', parseError);
              // Use fallback
              analysisResult = {
                categoria: 'outro',
                prioridade: 'posso_esperar',
                titulo: 'Novo Ticket',
                equipe_responsavel: null,
                justificativa: 'Análise automática com fallback'
              };
            }
          }
        } else {
          console.error('Erro na API da IA:', response.status, await response.text());
        }
      } catch (error) {
        console.error('Erro na classificação por IA:', error);
      }
    }

    // Se não temos analysisResult da IA, usar fallback
    if (!analysisResult) {
      // Gerar título baseado na descrição como fallback
      const generateFallbackTitle = (description: string): string => {
        const desc = description.toLowerCase();
        if (desc.includes('áudio') || desc.includes('audio') || desc.includes('som')) return 'Problema Áudio';
        if (desc.includes('planfeto') || desc.includes('panfleto') || desc.includes('mídia')) return 'Criação Mídia';
        if (desc.includes('solicitar') || desc.includes('preciso') || desc.includes('gostaria')) return 'Solicitação Material';
        if (desc.includes('sistema') || desc.includes('erro') || desc.includes('bug')) return 'Erro Sistema';
        if (desc.includes('evento')) return 'Evento Dúvida';
        
        // Fallback: pegar palavras importantes
        const words = description.trim().split(/\s+/).filter(word => 
          word.length > 3 && 
          !['preciso', 'gostaria', 'solicitar', 'favor', 'olá', 'ola'].includes(word.toLowerCase())
        );
        return words.slice(0, 3).join(' ') || 'Novo Ticket';
      };

      analysisResult = {
        categoria: 'outro',
        prioridade: 'posso_esperar', 
        titulo: generateFallbackTitle(message),
        equipe_responsavel: null,
        justificativa: 'Análise automática com fallback'
      };
    }

    console.log('Resultado final da classificação:', {
      categoria: analysisResult.categoria,
      prioridade: analysisResult.prioridade,
      equipe_id: equipeResponsavelId,
      equipe_nome: analysisResult.equipe_responsavel
    });

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
      analysisResult.sla_sugerido_horas = analysisResult.sla_sugerido_horas || 24;
      
      if (!equipeResponsavelId) {
        equipeResponsavelId = fallbackEquipeId;
      }
      
      console.log('Applied fallbacks:', {
        categoria: analysisResult.categoria,
        equipe_id: equipeResponsavelId,
        prioridade: analysisResult.prioridade
      });
    }

    // Criar ticket com dados da análise ou defaults - Split into two operations to avoid PostgreSQL DISTINCT/ORDER BY issue
    const { data: ticketBasic, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        unidade_id: unidade.id,
        franqueado_id: franqueadoId,
        titulo: analysisResult?.titulo || 'Novo Ticket',
        descricao_problema: message,
        categoria: analysisResult?.categoria || 'outro',
        subcategoria: analysisResult?.subcategoria || null,
        prioridade: analysisResult?.prioridade || 'posso_esperar',
        equipe_responsavel_id: equipeResponsavelId || equipes?.[0]?.id,
        canal_origem: 'typebot',
        status: 'aberto',
        escalonamento_nivel: 0,
        data_abertura: new Date().toISOString(),
        arquivos: attachments || [],
        log_ia: analysisResult ? {
          analysis_timestamp: new Date().toISOString(),
          ai_response: JSON.stringify(analysisResult),
          api_provider: apiProvider,
          model: modelToUse,
          categoria_sugerida: analysisResult.categoria,
          prioridade_sugerida: analysisResult.prioridade,
          equipe_sugerida: analysisResult.equipe_responsavel,
          justificativa: analysisResult.justificativa
        } : {}
      })
      .select('id, codigo_ticket')
      .single();

    if (ticketError) {
      console.error('Error creating ticket:', {
        code: ticketError.code,
        message: ticketError.message,
        hint: ticketError.hint,
        details: ticketError.details
      });
      return new Response(JSON.stringify({ 
        error: 'Erro ao criar ticket',
        details: ticketError.message,
        success: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the complete ticket data
    const { data: ticket, error: fetchError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketBasic.id)
      .single();

    if (fetchError) {
      console.error('Error fetching complete ticket:', {
        code: fetchError.code,
        message: fetchError.message,
        hint: fetchError.hint,
        details: fetchError.details
      });
      return new Response(JSON.stringify({ 
        error: 'Erro ao buscar dados do ticket',
        details: fetchError.message,
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

    // Call crisis AI analyst after ticket creation (if has team)
    if (ticket.equipe_responsavel_id) {
      try {
        console.log('🚨 Calling crisis AI analyst for ticket:', ticket.id);
        
        const analystResponse = await fetch(`${supabaseUrl}/functions/v1/crises-ai-analyst`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ticket_id: ticket.id,
            titulo: ticket.titulo,
            descricao_problema: ticket.descricao_problema,
            equipe_id: ticket.equipe_responsavel_id,
            categoria: ticket.categoria
          })
        });

        if (analystResponse.ok) {
          const analysisResult = await analystResponse.json();
          console.log('✅ Crisis analysis result:', analysisResult);
        } else {
          const errorText = await analystResponse.text();
          console.error('❌ Crisis analyst failed:', errorText);
        }
      } catch (analystError) {
        console.error('💥 Error calling crisis analyst:', analystError);
        // Continue without failing ticket creation
      }
    } else {
      console.log('⚠️ Ticket has no team assigned, skipping crisis analysis');
    }

    // Buscar dados atualizados do ticket após análise
    const { data: updatedTicket } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticket.id)
      .single();

    const finalTicket = updatedTicket || ticket;

    console.log('✅ Ticket criado com sucesso:', {
      codigo: finalTicket.codigo_ticket,
      categoria: finalTicket.categoria,
      prioridade: finalTicket.prioridade,
      equipe_id: finalTicket.equipe_responsavel_id,
      ia_analysis: !!finalTicket.log_ia
    });

    // Enviar notificação de criação de ticket
    try {
      console.log('📱 Enviando notificação de criação de ticket...');
      await supabase.functions.invoke('process-notifications', {
        body: {
          ticketId: finalTicket.id,
          type: 'ticket_created'
        }
      });
      console.log('✅ Notificação enviada com sucesso');
    } catch (notificationError) {
      console.error('❌ Erro ao enviar notificação:', notificationError);
      // Não falha a criação do ticket por causa da notificação
    }

    // Resposta de sucesso com análise da IA
    const responseData = {
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
          sla_sugerido_horas: finalTicket.log_ia?.analysis?.sla_sugerido_horas || 24,
          analysis_model: modelToUse
        }
      }
    };
    
    console.log('📤 Enviando resposta:', JSON.stringify(responseData, null, 2));
    
    return new Response(JSON.stringify(responseData), {
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