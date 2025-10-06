import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Import modules
import { prepararMensagemParaFranqueado } from './text-utils.ts';
import { encontrarDocumentosRelacionados, rerankComLLM, gerarRespostaComContexto } from './rag-engine.ts';
import { searchKnowledgeBase } from './knowledge-base.ts';
import { classifyTicket, classifyTeamOnly, generateFallbackClassification, applyIntelligentFallback, generateFallbackTitle } from './ai-classifier.ts';
import { 
  createTicket, 
  addInitialMessage, 
  findUnitByCode, 
  findFranqueadoByPassword, 
  getActiveTeams, 
  findTeamByName,
  findTeamByNameDirect,
  getSupabaseClient
} from './ticket-creator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const webhookToken = Deno.env.get('TYPEBOT_WEBHOOK_TOKEN');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 === TYPEBOT WEBHOOK CALLED ===');
    console.log('📨 Method:', req.method);
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
    console.log(
      'Received webhook payload - message length:',
      body?.message?.length,
      'codigo_unidade:',
      body?.codigo_unidade
    );

    const {
      message,
      codigo_unidade,
      user: { web_password } = {},
      attachments,
      category_hint,
      force_create = false,
      metadata,
      equipe_responsavel_nome,
      categoria,
      prioridade,
      titulo
    } = body;

    // Helper function to validate URL
    const isValidUrl = (string: string): boolean => {
      try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    };

    // Helper function to detect file type from URL
    const detectFileType = (url: string): string => {
      const ext = url.toLowerCase().split('.').pop() || '';
      
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        return 'imagem';
      }
      if (['mp4', 'avi', 'mov', 'wmv', 'webm'].includes(ext)) {
        return 'video';
      }
      if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
        return 'audio';
      }
      if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        return 'documento';
      }
      return 'arquivo';
    };

    // Helper function to get filename from URL
    const getFileNameFromUrl = (url: string): string => {
      try {
        const pathname = new URL(url).pathname;
        return pathname.split('/').pop() || 'arquivo';
      } catch {
        return 'arquivo';
      }
    };

    // Process attachments to validate URLs and format them properly
    const processedAttachments = (attachments || []).map((attachment: any) => {
      // If attachment is already an object with url, enhance it
      if (typeof attachment === 'object' && attachment.url) {
        return {
          ...attachment,
          tipo: attachment.tipo || detectFileType(attachment.url),
          nome: attachment.nome || getFileNameFromUrl(attachment.url)
        };
      }
      
      // If attachment is just a URL string, convert it to proper format
      if (typeof attachment === 'string' && isValidUrl(attachment)) {
        return {
          url: attachment,
          tipo: detectFileType(attachment),
          nome: getFileNameFromUrl(attachment)
        };
      }
      
      return attachment;
    }).filter((att: any) => att && (att.url || att.nome)); // Filter out invalid attachments

    console.log('Processed attachments:', processedAttachments);

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

    // Buscar unidade e franqueado
    const unidade = await findUnitByCode(codigo_unidade);
    let franqueadoId = null;
    
    if (web_password) {
      const franqueado = await findFranqueadoByPassword(web_password);
      if (franqueado) {
        franqueadoId = franqueado.id; // Already UUID
        console.log('Franqueado encontrado:', franqueadoId, '(tipo:', typeof franqueadoId, ')');
      } else {
        console.log('Franqueado não encontrado para senha web:', web_password);
      }
    }

    // Se não forçar criação, usar sistema de sugestão IA v4
    if (!force_create) {
      console.log('Force create is false, generating RAG suggestion using v4 hybrid pipeline...');
      
      try {
        const tempTicketData = {
          titulo: `Consulta via Typebot - ${new Date().toISOString()}`,
          descricao_problema: message,
          codigo_ticket: `TEMP-${Date.now()}`,
          categoria: category_hint || 'geral',
          prioridade: 'posso_esperar'
        };

        const textoDoTicket = `Título: ${tempTicketData.titulo}\nDescrição: ${tempTicketData.descricao_problema}`;

        // 1) recuperar candidatos (12)
        const candidatos = await encontrarDocumentosRelacionados(textoDoTicket, 12);

        // 2) rerank LLM (top-5)
        let docsSelecionados = await rerankComLLM(candidatos, textoDoTicket);
        if (!docsSelecionados.length) {
          console.warn('No docs after rerank; falling back to top-5 candidatos');
          docsSelecionados = candidatos.slice(0,5);
        }
        console.log('Docs selecionados para resposta:',
          docsSelecionados.map(d => `${d.id}:${d.titulo}`).join(' | ')
        );

        if (docsSelecionados.length) {
          // 3) gerar resposta curta com citação
          const respostaRAG = await gerarRespostaComContexto(docsSelecionados, textoDoTicket);
          
          try {
            const payload = JSON.parse(respostaRAG);
            const textoFinal = prepararMensagemParaFranqueado(payload.texto);
            
            const isUseful = !/não encontrei informações suficientes/i.test(textoFinal);
            if (isUseful) {
              console.log('Generated useful RAG v4 suggestion:', textoFinal);
              return new Response(JSON.stringify({
                action: 'suggestion',
                success: true,
                answer: textoFinal,
                source: 'rag_system',
                rag_metrics: {
                  documentos_encontrados: docsSelecionados.length,
                  candidatos_encontrados: candidatos.length,
                  pipeline: 'v4_hibrido',
                  selecionados: docsSelecionados.map(d => ({ id: d.id, titulo: d.titulo })),
                  fontes_utilizadas: payload.fontes || []
                },
                message: 'Sugestão RAG v4 gerada baseada na base de conhecimento'
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          } catch (e) {
            console.error('Error parsing RAG JSON response:', e);
            const textoFinal = prepararMensagemParaFranqueado(respostaRAG);
            const isUseful = !/não encontrei informações suficientes/i.test(textoFinal);
            if (isUseful) {
              console.log('Generated useful RAG v4 suggestion (fallback):', textoFinal);
              return new Response(JSON.stringify({
                action: 'suggestion',
                success: true,
                answer: textoFinal,
                source: 'rag_system',
                rag_metrics: {
                  documentos_encontrados: docsSelecionados.length,
                  candidatos_encontrados: candidatos.length,
                  pipeline: 'v4_hibrido_fallback',
                  selecionados: docsSelecionados.map(d => ({ id: d.id, titulo: d.titulo }))
                },
                message: 'Sugestão RAG v4 gerada (fallback)'
              }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
          }
        }

        // Fallback: KB tradicional
        const kbResult = await searchKnowledgeBase(message);
        
        if (kbResult.hasAnswer) {
          console.log('Answer found in knowledge base');
          return new Response(JSON.stringify({
            action: 'answer',
            success: true,
            answer: prepararMensagemParaFranqueado(kbResult.answer),
            sources: kbResult.sources,
            source: 'knowledge_base',
            message: 'Resposta encontrada na base de conhecimento'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Se nada funcionou, usar resposta padrão
        console.log('No relevant knowledge found, using default response');
        const defaultResponse = "Não tenho conhecimento sobre isso, vou abrir um ticket para que nosso suporte te ajude.";
        
        return new Response(JSON.stringify({
          action: 'suggestion',
          success: true,
          answer: defaultResponse,
          source: 'default',
          will_create_ticket: true,
          message: 'Resposta padrão - ticket será criado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        console.error('Error generating RAG suggestion:', error);
        
        return new Response(JSON.stringify({
          action: 'suggestion',
          success: true,
          answer: "Não tenho conhecimento sobre isso, vou abrir um ticket para que nosso suporte te ajude.",
          source: 'error_fallback',
          error: error.message,
          message: 'Erro na geração de sugestão - usando resposta padrão'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Criar ticket - buscar equipes e classificar
    console.log('Creating ticket - no suitable KB answer found');
    const equipes = await getActiveTeams();
    console.log('Equipes encontradas para análise:', JSON.stringify(equipes, null, 2));

    let analysisResult = null;
    let equipeResponsavelId = null;

    // Cenário 1: Se dados específicos foram fornecidos (categoria, prioridade, titulo), usar apenas para definir equipe
    const hasSpecificData = categoria || prioridade || titulo;
    
    // Verificar se foi fornecido nome da equipe no payload
    if (equipe_responsavel_nome) {
      console.log('🔍 Buscando equipe por nome:', equipe_responsavel_nome);
      const equipeEncontrada = await findTeamByNameDirect(equipe_responsavel_nome);
      if (equipeEncontrada) {
        equipeResponsavelId = equipeEncontrada.id;
        console.log('✅ Equipe encontrada:', equipeEncontrada.nome);
        
        // Usar dados fornecidos diretamente
        analysisResult = {
          categoria: categoria || 'outro',
          prioridade: prioridade || 'baixo',
          titulo: titulo || generateFallbackTitle(message),
          equipe_responsavel: equipeEncontrada.nome,
          justificativa: 'Equipe especificada diretamente no payload'
        };
      } else {
        // Equipe fornecida mas não encontrada - usar IA apenas para equipe
        console.log('❌ Equipe não encontrada, usando IA para definir equipe...');
        
        const existingData = {
          categoria: categoria || undefined,
          prioridade: prioridade || undefined,
          titulo: titulo || undefined
        };
        
        const teamClassification = await classifyTeamOnly(message, equipes, existingData);
        
        if (teamClassification) {
          // Buscar equipe sugerida pela IA
          const equipeEncontrada = await findTeamByNameDirect(teamClassification.equipe_responsavel);
          if (equipeEncontrada) {
            equipeResponsavelId = equipeEncontrada.id;
            console.log('✅ Equipe definida pela IA:', equipeEncontrada.nome);
          }
          
          analysisResult = {
            categoria: categoria || 'outro',
            prioridade: prioridade || 'baixo', 
            titulo: titulo || generateFallbackTitle(message),
            equipe_responsavel: teamClassification.equipe_responsavel,
            justificativa: teamClassification.justificativa
          };
        } else {
          // Fallback se IA falhou
          const fallback = applyIntelligentFallback(message, equipes);
          analysisResult = {
            categoria: categoria || fallback.categoria,
            prioridade: prioridade || 'baixo',
            titulo: titulo || generateFallbackTitle(message),
            equipe_responsavel: fallback.equipeId ? equipes.find(e => e.id === fallback.equipeId)?.nome || null : null,
            justificativa: 'Equipe definida por fallback inteligente'
          };
          equipeResponsavelId = fallback.equipeId;
        }
      }
    } else if (hasSpecificData) {
      // Cenário 2: Dados fornecidos mas sem equipe - usar IA apenas para equipe
      console.log('📋 Usando dados fornecidos e IA apenas para equipe...');
      
      const existingData = {
        categoria: categoria || undefined,
        prioridade: prioridade || undefined,
        titulo: titulo || undefined
      };
      
      const teamClassification = await classifyTeamOnly(message, equipes, existingData);
      
      if (teamClassification) {
        // Buscar equipe sugerida pela IA
        const equipeEncontrada = await findTeamByNameDirect(teamClassification.equipe_responsavel);
        if (equipeEncontrada) {
          equipeResponsavelId = equipeEncontrada.id;
          console.log('✅ Equipe definida pela IA:', equipeEncontrada.nome);
        }
        
        analysisResult = {
          categoria: categoria || 'outro',
          prioridade: prioridade || 'baixo',
          titulo: titulo || generateFallbackTitle(message),
          equipe_responsavel: teamClassification.equipe_responsavel,
          justificativa: teamClassification.justificativa
        };
      } else {
        // Fallback se IA falhou
        const fallback = applyIntelligentFallback(message, equipes);
        analysisResult = {
          categoria: categoria || fallback.categoria,
          prioridade: prioridade || 'baixo',
          titulo: titulo || generateFallbackTitle(message),
          equipe_responsavel: fallback.equipeId ? equipes.find(e => e.id === fallback.equipeId)?.nome || null : null,
          justificativa: 'Equipe definida por fallback inteligente'
        };
        equipeResponsavelId = fallback.equipeId;
      }
    } else {
      // Análise IA completa se equipe não foi especificada
      if (equipes && equipes.length > 0) {
        analysisResult = await classifyTicket(message, equipes);
        
        if (analysisResult) {
          console.log('Classificação final da IA:', analysisResult);
          
          // Buscar equipe por nome se foi sugerida
          if (analysisResult.equipe_responsavel) {
            console.log('Procurando equipe:', analysisResult.equipe_responsavel);
            const equipeEncontrada = await findTeamByName(analysisResult.equipe_responsavel, equipes);
            
            if (equipeEncontrada) {
              equipeResponsavelId = equipeEncontrada.id;
              console.log(`Equipe encontrada: ${equipeEncontrada.nome} (ID: ${equipeEncontrada.id})`);
            } else {
              console.log('Nenhuma equipe encontrada para:', analysisResult.equipe_responsavel);
            }
          }
        }
      }

      // Fallback se análise falhou
      if (!analysisResult) {
        analysisResult = generateFallbackClassification(message);
      }

      // Aplicar fallbacks inteligentes se necessário
      if (!analysisResult.categoria || !analysisResult.equipe_responsavel) {
        console.log('AI analysis incomplete, applying fallbacks...');
        const fallback = applyIntelligentFallback(message, equipes);
        
        if (!analysisResult.categoria) {
          analysisResult.categoria = fallback.categoria;
        }
        if (!equipeResponsavelId) {
          equipeResponsavelId = fallback.equipeId;
        }
      }
    }

    console.log('Resultado final da classificação:', {
      categoria: analysisResult.categoria,
      prioridade: analysisResult.prioridade,
      equipe_id: equipeResponsavelId,
      equipe_nome: analysisResult.equipe_responsavel
    });

    // UUID validation is handled by ticket-creator
    console.log('✅ Unidade ID validado:', unidade.id, '(tipo:', typeof unidade.id, ')');

    // Criar o ticket
    const ticketData = {
      titulo: analysisResult.titulo,
      descricao_problema: message,
      categoria: analysisResult.categoria,
      prioridade: analysisResult.prioridade,
      unidade_id: unidade.id,
      equipe_responsavel_id: equipeResponsavelId,
      franqueado_id: franqueadoId,
      canal_origem: 'typebot'
    };

    const ticket = await createTicket(ticketData);
    await addInitialMessage(ticket.id, message, processedAttachments);

    console.log('✅ Ticket created successfully:', ticket.codigo_ticket);

    // Enviar notificação de ticket criado imediatamente
    try {
      console.log('📤 Enviando notificação de ticket criado...');
      
      const notificationResult = await fetch(`${supabaseUrl}/functions/v1/process-notifications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          type: 'ticket_created',
          payload: {
            unidade_id: ticket.unidade_id,
            codigo_ticket: ticket.codigo_ticket,
            categoria: ticket.categoria,
            prioridade: ticket.prioridade
          }
        })
      });

      if (notificationResult.ok) {
        const notificationData = await notificationResult.json();
        console.log('✅ Notificação de ticket criado enviada:', notificationData);
      } else {
        console.error('❌ Erro ao enviar notificação:', await notificationResult.text());
      }
    } catch (notificationError) {
      console.error('❌ Erro ao processar notificação:', notificationError);
      // Continue sem falhar a criação do ticket
    }

    // Chamar análise de crises inteligente se o ticket tem equipe responsável
    let crisisAnalysisResult = null;
    if (ticket.equipe_responsavel_id) {
      try {
        console.log('🔍 Chamando análise inteligente de crises...');
        
        const analystResponse = await fetch(`${supabaseUrl}/functions/v1/crises-ai-analyst`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
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
          crisisAnalysisResult = await analystResponse.json();
          console.log('🔍 Crisis analysis result:', crisisAnalysisResult);
        } else {
          console.error('❌ Crisis analyst failed:', await analystResponse.text());
        }
      } catch (analystError) {
        console.error('❌ Error calling crisis analyst:', analystError);
        // Continue without failing ticket creation
      }
    } else {
      crisisAnalysisResult = { 
        action: "no_team_assigned",
        message: "Ticket sem equipe responsável - análise de crise ignorada"
      };
    }

    // Notificação já foi enviada automaticamente pelo trigger do banco

    // Buscar nome da equipe se houver equipe responsável
    let equipeNome = null;
    if (ticket.equipe_responsavel_id) {
      try {
        const supabase = getSupabaseClient();
        const { data: equipe } = await supabase
          .from('equipes')
          .select('nome')
          .eq('id', ticket.equipe_responsavel_id)
          .single();
        
        equipeNome = equipe?.nome || null;
      } catch (error) {
        console.warn('⚠️ Erro ao buscar nome da equipe:', error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      action: 'ticket_created',
      ticket: {
        id: ticket.id,
        codigo_ticket: ticket.codigo_ticket,
        titulo: ticket.titulo,
        categoria: ticket.categoria,
        prioridade: ticket.prioridade,
        status: ticket.status,
        data_abertura: ticket.data_abertura,
        equipe_responsavel_id: ticket.equipe_responsavel_id,
        equipe_responsavel_nome: equipeNome
      },
      ai_analysis: crisisAnalysisResult,
      message: `Ticket ${ticket.codigo_ticket} criado com sucesso`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in typebot webhook:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: 'Erro interno no webhook'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});