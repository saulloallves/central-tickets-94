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
const zapiClient = new ZAPIClient();
const aiProcessor = new AIProcessor(supabase, zapiClient, conversationManager);

function shouldSkipMessage(payload: ZAPIMessage): boolean {
  // Skip if it's a status reply or no text
  if (payload.isStatusReply || !payload.text?.message) {
    return true;
  }
  
  // FILTRO ESPECÍFICO: Processar mensagens do grupo específico OU mensagens privadas
  const TARGET_GROUP_ID = '120363258963635302-group';
  
  if (payload.isGroup) {
    // Se é grupo, só processar se for o grupo específico
    if (payload.phone !== TARGET_GROUP_ID) {
      console.log(`Skipping message: not from target group (${payload.phone})`);
      return true;
    }
  }
  // Se não é grupo (mensagem privada), processar normalmente
  
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

  // If it's an incoming message (not from us), check for ticket response state
  if (!payload.fromMe && payload.text?.message) {
    // Verificar se usuário está aguardando responder ticket
    const conversationState = conversation.meta as any;
    
    if (conversationState?.awaiting_response_for_ticket) {
      const expiresAt = new Date(conversationState.expires_at);
      const now = new Date();
      
      if (now <= expiresAt) {
        // Processar como resposta ao ticket
        console.log(`🎫 Processando resposta ao ticket: ${conversationState.awaiting_response_for_ticket}`);
        
        const ticketId = conversationState.awaiting_response_for_ticket;
        const userMessage = payload.text.message;
        
        // Salvar resposta no ticket
        const { error: messageError } = await supabase
          .from('ticket_mensagens')
          .insert({
            ticket_id: ticketId,
            direcao: 'entrada',
            mensagem: userMessage,
            canal: 'whatsapp',
            usuario_id: null,
            created_at: new Date().toISOString()
          });

        if (!messageError) {
          // Buscar dados do ticket para confirmação
          const { data: ticket } = await supabase
            .from('tickets')
            .select('codigo_ticket, titulo')
            .eq('id', ticketId)
            .single();

          // Enviar confirmação
          const confirmationMessage = `✅ *Resposta registrada com sucesso!*

📋 Ticket #${ticket?.codigo_ticket}
📄 ${ticket?.titulo}

Sua mensagem foi adicionada ao histórico do atendimento.`;

          sentReply = await zapiClient.sendTextMessage(
            payload.phone,
            payload.instanceId,
            confirmationMessage
          );
        } else {
          console.error('Erro ao salvar resposta do ticket:', messageError);
          sentReply = await zapiClient.sendTextMessage(
            payload.phone,
            payload.instanceId,
            "❌ Erro ao processar sua resposta. Tente novamente."
          );
        }

        // Limpar estado conversacional
        await supabase
          .from('whatsapp_conversas')
          .update({
            meta: {},
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id);

        console.log('🧹 Estado conversacional limpo');
        
      } else {
        // Estado expirado, limpar e processar normalmente
        console.log('⏰ Estado conversacional expirado, processando com IA');
        
        await supabase
          .from('whatsapp_conversas')
          .update({
            meta: {},
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id);

        // Processar com IA normalmente
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
    } else {
      // Processar com IA normalmente
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