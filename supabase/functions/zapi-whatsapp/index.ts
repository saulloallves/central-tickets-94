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
  return payload.isStatusReply || !payload.text?.message;
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

  // If it's an incoming message (not from us), generate and send AI response
  if (!payload.fromMe && payload.text?.message) {
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