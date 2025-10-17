// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { corsHeaders } from './utils.ts';
import { ZAPIMessage, ConversationMessageData } from './types.ts';
import { ConversationManager } from './conversation-manager.ts';
import { ZAPIClient } from './zapi-client.ts';
import { AIProcessor } from './ai-processor.ts';

// Initialize Supabase client with service role key
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize services
const conversationManager = new ConversationManager(supabase);
const zapiClient = new ZAPIClient(supabase);
const aiProcessor = new AIProcessor(supabase, zapiClient, conversationManager);

// Load Z-API configuration from database
await zapiClient.loadConfig();

function shouldSkipMessage(payload: ZAPIMessage): boolean {
  // Skip if it's a status reply or no text
  if (payload.isStatusReply || !payload.text?.message) {
    return true;
  }
  
  // FILTROS: Não processar mensagens que são templates de sistema
  const messageText = payload.text?.message?.toLowerCase() || '';
  
  // Detectar palavras de ativação do bot_base_1 e encaminhar
  const BOT_ACTIVATION_KEYWORDS = ['menu', 'ola robo', 'olá robô', 'abacate'];
  if (BOT_ACTIVATION_KEYWORDS.some(keyword => messageText && messageText.includes(keyword))) {
    console.log('Detected bot_base_1 activation keyword, will forward to bot_base_1');
    // Não pular, deixar continuar para ser processado e encaminhado para bot_base_1
  }
  
  // Filtrar templates de SLA
  if (messageText.includes('sla') || messageText.includes('vencido') || messageText.includes('prazo')) {
    console.log('Skipping message: SLA template detected');
    return true;
  }
  
  // Filtrar templates de ticket criado
  if (messageText.includes('ticket #') || messageText.includes('🎫')) {
    console.log('Skipping message: Ticket creation template detected');
    return true;
  }
  
  // Filtrar templates de resposta com botões
  if (messageText.includes('responder') && messageText.includes('finalizar') && payload.text?.message?.includes('📝')) {
    console.log('Skipping message: Response template with buttons detected');
    return true;
  }
  
  // Filtrar mensagens que vêm do próprio sistema (fromMe = true)
  if (payload.fromMe) {
    console.log('Skipping message: Message sent from our system');
    return true;
  }
  
  // Filtrar respostas automáticas conhecidas
  if (messageText.includes('✅ resposta registrada') || messageText.includes('ticket foi criado')) {
    console.log('Skipping message: Automated system response detected');
    return true;
  }
  
  // Filtrar notificações de resposta de ticket (template específico)
  if (messageText.includes('💬 resposta do ticket') || 
      messageText.includes('resposta do ticket') ||
      messageText.includes('📋 título:') ||
      (messageText.includes('equipe:') && messageText.includes('prioridade:') && messageText.includes('status:'))) {
    console.log('Skipping message: Ticket response notification template detected');
    return true;
  }
  
  // Filtrar mensagens que contêm o formato do template de resposta
  if (messageText.includes('respondido em:') || 
      messageText.includes('texto_resposta') ||
      (messageText.includes('título:') && messageText.includes('equipe:') && messageText.includes('status:'))) {
    console.log('Skipping message: System notification template detected');
    return true;
  }

  return false;
}

function createMessageData(payload: ZAPIMessage): ConversationMessageData {
  return {
    id: payload.messageId,
    from_me: payload.fromMe,
    text: payload.text.message,
    moment: new Date(payload.momment).toISOString(),
    status: payload.status,
    type: payload.type,
    meta: {
      senderName: payload.senderName,
      senderPhoto: payload.senderPhoto,
      messageId: payload.messageId
    }
  };
}

async function handleWebhook(payload: ZAPIMessage) {
  console.log('🔍 Webhook recebido:', {
    phone: payload.phone,
    fromMe: payload.fromMe,
    isGroup: payload.isGroup,
    hasText: !!payload.text?.message,
    senderName: payload.senderName,
    messagePreview: payload.text?.message?.substring(0, 50) + '...'
  });
  console.log('Received Z-API webhook:', JSON.stringify(payload, null, 2));
  console.log('Message details:', {
    isGroup: payload.isGroup,
    fromMe: payload.fromMe,
    hasText: !!payload.text?.message,
    phone: payload.phone,
    chatName: payload.chatName,
    senderName: payload.senderName
  });

  if (shouldSkipMessage(payload)) {
    console.log('Skipping message: status reply or no text');
    return { ok: true, skipped: true };
  }

  // Create message data
  const messageData = createMessageData(payload);

  // Upsert conversation
  const conversation = await conversationManager.upsertConversation(
    payload.instanceId,
    payload.connectedPhone,
    payload.phone,
    payload.chatName || payload.senderName,
    payload.senderLid,
    payload.senderPhoto,
    payload.isGroup,
    messageData
  );

  console.log('Conversation upserted:', conversation.id);

  let sentReply = null;

  // Check for button clicks first
  if (!payload.fromMe && payload.buttonsResponseMessage?.buttonId) {
    console.log(`🔘 Button clicked: ${payload.buttonsResponseMessage.buttonId}`);
    
    // Call bot_base_1 to handle button clicks
    try {
      const functionsBaseUrl = `https://${Deno.env.get('SUPABASE_URL')?.split('//')[1]}/functions/v1` || 'https://hryurntaljdisohawpqf.supabase.co/functions/v1';
      
      const botResponse = await fetch(`${functionsBaseUrl}/bot_base_1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify(payload)
      });

      if (botResponse.ok) {
        const botResult = await botResponse.json();
        console.log('✅ Button handled by bot_base_1:', botResult);
        return { ok: true, button_handled: true, result: botResult };
      } else {
        console.error('❌ Bot failed to handle button:', await botResponse.text());
      }
    } catch (error) {
      console.error('❌ Error calling bot_base_1:', error);
    }
  }

  // If it's an incoming message (not from us), check for bot activation keywords FIRST
  if (!payload.fromMe && payload.text?.message) {
    const messageText = payload.text.message.toLowerCase();
    const BOT_ACTIVATION_KEYWORDS = ['menu', 'ola robo', 'olá robô', 'abacate'];
    
    if (BOT_ACTIVATION_KEYWORDS.some(keyword => messageText.includes(keyword))) {
      console.log(`🤖 Bot keyword detected: "${messageText}" - forwarding to bot_base_1`);
      
      try {
        const functionsBaseUrl = `https://${Deno.env.get('SUPABASE_URL')?.split('//')[1]}/functions/v1` || 'https://hryurntaljdisohawpqf.supabase.co/functions/v1';
        
        const botResponse = await fetch(`${functionsBaseUrl}/bot_base_1`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify(payload)
        });

        if (botResponse.ok) {
          const botResult = await botResponse.json();
          console.log('✅ Keyword handled by bot_base_1:', botResult);
          return { ok: true, bot_keyword_handled: true, result: botResult };
        } else {
          console.error('❌ Bot failed to handle keyword:', await botResponse.text());
        }
      } catch (error) {
        console.error('❌ Error calling bot_base_1 for keyword:', error);
      }
    }

    // PRIMEIRA PRIORIDADE: Verificar se grupo está aguardando resposta ao ticket
    console.log(`🔍 Verificando estado do grupo: ${payload.phone}`);
    
    const { data: groupState, error: groupStateError } = await supabase
      .from('whatsapp_group_states')
      .select('*')
      .eq('group_phone', payload.phone)
      .eq('awaiting_ticket_response', true)
      .maybeSingle();

    if (groupStateError) {
      console.error('❌ Erro ao consultar estado do grupo:', groupStateError);
    } else if (groupState) {
      console.log(`📋 Grupo está aguardando resposta ao ticket:`, groupState);
      
      const now = new Date();
      const expiresAt = new Date(groupState.expires_at);
      
      console.log(`⏰ Expira em: ${expiresAt.toISOString()}, Agora: ${now.toISOString()}`);
      
      if (now <= expiresAt) {
        // Processar como resposta ao ticket
        console.log(`📝 Processando como resposta ao ticket: ${groupState.ticket_id}`);
        
        try {
          // Salvar mensagem como resposta ao ticket
          const { error: insertError } = await supabase
            .from('ticket_mensagens')
            .insert({
              ticket_id: groupState.ticket_id,
              usuario_id: null, // Será definido pelo RLS ou trigger
              mensagem: payload.text.message,
              direcao: 'entrada',
              canal: 'whatsapp',
              meta: {
                whatsapp_message_id: payload.messageId,
                sender_name: payload.senderName,
                sender_phone: payload.participantPhone || payload.phone,
                group_phone: payload.isGroup ? payload.phone : null,
                timestamp: new Date(payload.momment).toISOString(),
                processed_as_ticket_response: true
              }
            });

          if (insertError) {
            console.error('❌ Erro ao salvar resposta do ticket:', insertError);
            sentReply = await zapiClient.sendTextMessage(
              payload.phone,
              payload.instanceId,
              "❌ Erro ao processar sua resposta. Tente novamente."
            );
          } else {
            // ✅ CORREÇÃO SLA: Despausar SLA quando franqueado responde
            console.log('⏸️ Despausando SLA do ticket após resposta do franqueado...');
            const { error: unpauseError } = await supabase
              .from('tickets')
              .update({ 
                sla_pausado_mensagem: false,
                sla_ultima_atualizacao: new Date().toISOString() // ← CRÍTICO: Reset timestamp
              })
              .eq('id', groupState.ticket_id);
            
            if (unpauseError) {
              console.error('❌ Erro ao despausar SLA:', unpauseError);
            } else {
              console.log('✅ SLA despausado com sucesso');
            }
            console.log('✅ Resposta do ticket salva com sucesso');
            
            // Buscar dados do ticket para confirmação
            const { data: ticket } = await supabase
              .from('tickets')
              .select('codigo_ticket, titulo')
              .eq('id', groupState.ticket_id)
              .maybeSingle();

            // Enviar confirmação
            const confirmationMessage = `✅ *Resposta registrada com sucesso!*

📋 Ticket #${ticket?.codigo_ticket || 'N/A'}
📄 ${ticket?.titulo || 'Ticket'}

Sua mensagem foi adicionada ao histórico do atendimento.`;

            sentReply = await zapiClient.sendTextMessage(
              payload.phone,
              payload.instanceId,
              confirmationMessage
            );
          }

          // Limpar estado de aguardar resposta
          const { error: clearError } = await supabase
            .from('whatsapp_group_states')
            .update({
              awaiting_ticket_response: false,
              ticket_id: null,
              expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('group_phone', payload.phone);

          if (clearError) {
            console.error('❌ Erro ao limpar estado do grupo:', clearError);
          } else {
            console.log('✅ Estado de resposta ao ticket limpo');
          }

          // Retornar SEM processar com IA
          return { 
            ok: true, 
            conversation_id: conversation.id,
            sent_reply: sentReply,
            ticket_response_processed: true
          };
          
        } catch (error) {
          console.error('❌ Erro ao processar resposta do ticket:', error);
          // Limpar estado mesmo em caso de erro
          await supabase
            .from('whatsapp_group_states')
            .update({
              awaiting_ticket_response: false,
              ticket_id: null,
              expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('group_phone', payload.phone);
        }
      } else {
        // Estado expirado, limpar
        console.log('⏰ Estado de resposta ao ticket expirado, limpando...');
        await supabase
          .from('whatsapp_group_states')
          .update({
            awaiting_ticket_response: false,
            ticket_id: null,
            expires_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('group_phone', payload.phone);
      }
    } else {
      console.log(`📍 Grupo não está aguardando resposta ao ticket, processando normalmente`);
    }

    // Process with AI if not a ticket response or if ticket state expired
    console.log('Generating AI response using RAG v4 for message:', payload.text.message);
    sentReply = await aiProcessor.processIncomingMessage(
      payload.text.message,
      payload.phone,
      payload.instanceId,
      payload.connectedPhone,
      payload.chatName,
      payload.senderName,
      payload.senderLid,
      payload.senderPhoto,
      payload.isGroup
    );
  }

  return { 
    ok: true, 
    conversation_id: conversation.id,
    sent_reply: sentReply 
  };
}

serve(async (req) => {
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  console.log('User-Agent:', req.headers.get('user-agent'));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === 'GET' && req.url.endsWith('/health')) {
    return new Response(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      zapi_configured: zapiClient.isConfigured()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Handle POST requests for health checks from UI
  if (req.method === 'POST') {
    try {
      const payload = await req.json();
      
      // Handle health check action
      if (payload.action === 'health_check') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          zapi_configured: zapiClient.isConfigured(),
          instance_details: {
            has_instance_id: !!Deno.env.get('ZAPI_INSTANCE_ID'),
            has_token: !!Deno.env.get('ZAPI_TOKEN'),
            has_client_token: !!Deno.env.get('ZAPI_CLIENT_TOKEN'),
            base_url: Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Handle webhook payload (existing logic)
      const result = await handleWebhook(payload as ZAPIMessage);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (error) {
      console.error('Error in zapi-whatsapp function:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});