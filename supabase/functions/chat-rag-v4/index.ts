// Using native Deno.serve (no import needed)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { ConversationManager } from './conversation-manager.ts';
import { encontrarDocumentosRelacionados, rerankComLLM, gerarRespostaComContexto } from './rag-engine.ts';
import { ZAPIClient } from './zapi-client.ts';
import { ZAPIMessage, ConversationMessageData } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Auto-detect mode based on payload structure
function detectMode(payload: any): 'whatsapp' | 'web' {
  // WhatsApp payload has specific Z-API fields
  if (payload.instanceId && payload.phone && payload.fromMe !== undefined) {
    return 'whatsapp';
  }
  // Web payload is simpler
  return 'web';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const mode = detectMode(payload);
    
    console.log(`🔍 Detected mode: ${mode}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (mode === 'whatsapp') {
      return await handleWhatsAppMode(payload as ZAPIMessage, supabase);
    } else {
      return await handleWebMode(payload, supabase);
    }

  } catch (error) {
    console.error('❌ Error in chat-rag-v4:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleWhatsAppMode(zapiPayload: ZAPIMessage, supabase: any) {
  const startTime = Date.now();
  console.log('📱 [WhatsApp Mode] Processing Z-API webhook');

  const conversationManager = new ConversationManager(supabase);
  const zapiClient = new ZAPIClient(supabase);
  await zapiClient.loadConfig();

  // Extract message data
  const userMessage = zapiPayload.text?.message || '';
  if (!userMessage) {
    console.log('⚠️ Empty message, skipping');
    return new Response(
      JSON.stringify({ success: false, error: 'Empty message' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // ✅ DEDUPLICATION CHECK: Verify if messageId was already processed
  // Use 'id' field from Z-API webhook (not 'messageId')
  const messageId = zapiPayload.id || zapiPayload.messageId;
  console.log(`📨 Recebido messageId: ${messageId}`);
  
  if (messageId) {
    const { data: alreadyProcessed } = await supabase
      .from('chat_rag_processed_messages')
      .select('message_id, processed_at')
      .eq('message_id', messageId)
      .maybeSingle();

    if (alreadyProcessed) {
      console.log(`⏭️ DUPLICADO: messageId ${messageId} já processado em ${alreadyProcessed.processed_at}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'Duplicate message already processed',
          original_processing: alreadyProcessed.processed_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log(`✅ NOVA mensagem: ${messageId}`);
    }
  } else {
    console.warn('⚠️ Webhook sem messageId - não é possível deduplicar');
  }

  // Skip messages from the bot itself (prevent self-response loop)
  if (zapiPayload.fromMe || zapiPayload.phone === zapiPayload.connectedPhone) {
    console.log(`⚠️ Skipping message: sent from bot itself (phone: ${zapiPayload.phone}, connected: ${zapiPayload.connectedPhone})`);
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: 'Message from bot itself' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create user message data
  const userMessageData: ConversationMessageData = {
    id: zapiPayload.messageId || crypto.randomUUID(),
    from_me: zapiPayload.fromMe,
    text: userMessage,
    moment: new Date(zapiPayload.momment || Date.now()).toISOString(),
    status: zapiPayload.status || 'RECEIVED',
    type: zapiPayload.type || 'chat',
    meta: {
      senderName: zapiPayload.senderName,
      senderPhoto: zapiPayload.senderPhoto,
      messageId: zapiPayload.messageId
    }
  };

  // Save user message in whatsapp_conversas (with instance_id = 'chat-rag-v4-whatsapp')
  const conversation = await conversationManager.upsertConversation(
    'chat-rag-v4-whatsapp',
    zapiPayload.connectedPhone,
    zapiPayload.phone,
    zapiPayload.chatName || zapiPayload.senderName,
    zapiPayload.senderLid,
    zapiPayload.senderPhoto,
    zapiPayload.isGroup,
    userMessageData
  );

  console.log(`💬 Conversation ID: ${conversation.id}`);

  // Get history (filter by instance_id = 'chat-rag-v4-whatsapp')
  const history = (conversation.conversa || []).slice(-10);
  console.log(`📖 History: ${history.length} messages`);

  // RAG Pipeline
  const candidatos = await encontrarDocumentosRelacionados(userMessage, 12);
  if (candidatos.length === 0) {
    console.log('❌ No documents found');
    await zapiClient.sendMessage(
      zapiPayload.phone,
      'Desculpe, não encontrei informações relevantes na base de conhecimento.'
    );
    return new Response(
      JSON.stringify({ success: true, sent: true, message: 'No docs found response sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const docsSelecionados = await rerankComLLM(candidatos, userMessage);
  const resposta = await gerarRespostaComContexto(
    docsSelecionados,
    userMessage,
    history,
    zapiPayload.phone
  );

  console.log(`🤖 Generated response (${resposta.length} chars)`);

  // Send response via Z-API
  const sent = await zapiClient.sendMessage(zapiPayload.phone, resposta);

  // ✅ MARK as processed to prevent duplication
  if (sent && messageId) {
    console.log(`🔒 Registrando messageId ${messageId} como processado...`);
    const { error: insertError } = await supabase
      .from('chat_rag_processed_messages')
      .insert({
        message_id: messageId,
        instance_id: zapiPayload.instanceId || 'chat-rag-v4-whatsapp',
        contact_phone: zapiPayload.phone,
        processed_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('❌ ERRO ao marcar como processada:', insertError);
    } else {
      console.log(`✅ messageId ${messageId} registrado com sucesso`);
    }
  } else {
    console.warn(`⚠️ Não registrado: sent=${sent}, messageId=${messageId}`);
  }

  // Save AI response in whatsapp_conversas
  if (sent) {
    const aiMessageData: ConversationMessageData = {
      id: crypto.randomUUID(),
      from_me: true,
      text: resposta,
      moment: new Date().toISOString(),
      status: 'SENT',
      type: 'chat',
      meta: {
        ai_generated: true,
        docs_used: docsSelecionados.map(d => d.id),
        original_message: userMessage
      }
    };

    await conversationManager.upsertConversation(
      'chat-rag-v4-whatsapp',
      zapiPayload.connectedPhone,
      zapiPayload.phone,
      zapiPayload.chatName || zapiPayload.senderName,
      zapiPayload.senderLid,
      zapiPayload.senderPhoto,
      zapiPayload.isGroup,
      aiMessageData
    );
  }

  const processingTime = Date.now() - startTime;
  console.log(`✅ WhatsApp mode completed in ${processingTime}ms`);

  return new Response(
    JSON.stringify({
      success: true,
      mode: 'whatsapp',
      sent,
      conversation_id: conversation.id,
      response_preview: resposta.substring(0, 100) + '...',
      processing_time_ms: processingTime
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleWebMode(payload: any, supabase: any) {
  const startTime = Date.now();
  console.log('🌐 [Web Mode] Processing HTTP request');

  const { message, phone, user_identifier, include_history = true } = payload;

  if (!message || typeof message !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Campo "message" é obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const conversationManager = new ConversationManager(supabase);

  // Normalize phone if provided
  let contactPhone = phone;
  if (contactPhone) {
    // Remove non-numeric characters
    contactPhone = contactPhone.replace(/\D/g, '');
    
    // Add country code if needed (Brazil = 55)
    if (!contactPhone.startsWith('55') && contactPhone.length >= 10) {
      contactPhone = '55' + contactPhone;
    }
    
    console.log(`📞 Using phone as identifier: ${contactPhone}`);
  } else {
    contactPhone = user_identifier || crypto.randomUUID();
    console.log(`🆔 Using identifier: ${contactPhone}`);
  }
  
  // Create user message data
  const userMessageData: ConversationMessageData = {
    id: crypto.randomUUID(),
    from_me: false,
    text: message,
    moment: new Date().toISOString(),
    status: 'RECEIVED',
    type: 'web-chat',
    meta: {
      source: 'web'
    }
  };

  // Save in whatsapp_conversas with instance_id = 'chat-rag-v4-web'
  const conversation = await conversationManager.upsertConversation(
    'chat-rag-v4-web',
    'system',
    contactPhone,
    'Web Chat',
    null,
    null,
    false,
    userMessageData
  );

  console.log(`💬 Conversation ID: ${conversation.id}, User: ${contactPhone}`);

  // Get history (filter by instance_id = 'chat-rag-v4-web')
  const history = include_history ? (conversation.conversa || []).slice(-10) : [];
  console.log(`📖 History: ${history.length} messages`);

  // RAG Pipeline
  const candidatos = await encontrarDocumentosRelacionados(message, 12);
  if (candidatos.length === 0) {
    console.log('❌ No documents found');
    return new Response(
      JSON.stringify({
        success: false,
        conversation_id: conversation.id,
        user_identifier: contactPhone,
        phone: phone || null,
        error: 'Não encontrei informações relevantes na base de conhecimento'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const docsSelecionados = await rerankComLLM(candidatos, message);
  const resposta = await gerarRespostaComContexto(
    docsSelecionados,
    message,
    history,
    contactPhone
  );

  console.log(`🤖 Generated response (${resposta.length} chars)`);

  // Save AI response
  const aiMessageData: ConversationMessageData = {
    id: crypto.randomUUID(),
    from_me: true,
    text: resposta,
    moment: new Date().toISOString(),
    status: 'SENT',
    type: 'web-chat',
    meta: {
      source: 'web',
      ai_generated: true,
      docs_used: docsSelecionados.map(d => d.id),
      relevance_scores: docsSelecionados.map(d => d.relevance_score)
    }
  };

  await conversationManager.upsertConversation(
    'chat-rag-v4-web',
    'system',
    contactPhone,
    'Web Chat',
    null,
    null,
    false,
    aiMessageData
  );

  const processingTime = Date.now() - startTime;
  console.log(`✅ Web mode completed in ${processingTime}ms`);

  return new Response(
    JSON.stringify({
      success: true,
      mode: 'web',
      conversation_id: conversation.id,
      user_identifier: contactPhone,
      phone: phone || null,
      response: resposta,
      docs_used: docsSelecionados.map(d => ({
        id: d.id,
        titulo: d.titulo,
        relevance_score: d.relevance_score
      })),
      metadata: {
        processing_time_ms: processingTime,
        history_length: history.length,
        documents_found: candidatos.length,
        documents_used: docsSelecionados.length
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
