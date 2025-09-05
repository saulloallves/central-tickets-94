import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role key
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Z-API credentials
const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
const zapiToken = Deno.env.get('ZAPI_TOKEN');
const zapiBaseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';

interface ZAPIMessage {
  isStatusReply: boolean;
  senderLid: string;
  connectedPhone: string;
  waitingMessage: boolean;
  isEdit: boolean;
  isGroup: boolean;
  isNewsletter: boolean;
  instanceId: string;
  messageId: string;
  phone: string;
  fromMe: boolean;
  momment: number;
  status: string;
  chatName: string;
  senderPhoto: string;
  senderName: string;
  participantPhone?: string;
  participantLid?: string;
  photo: string;
  broadcast: boolean;
  type: string;
  text: {
    message: string;
    description?: string;
    title?: string;
    url?: string;
    thumbnailUrl?: string;
  };
}

function normalizePhone(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If it starts with 55 (Brazil), keep as is
  if (cleaned.startsWith('55')) {
    return cleaned;
  }
  
  // If it doesn't start with country code, assume Brazil (55)
  if (cleaned.length >= 10) {
    return `55${cleaned}`;
  }
  
  return cleaned;
}

function formatResponseForFranqueado(aiResponse: string): string {
  // Remove markdown citations like [Fonte 1], [Fonte 2], etc.
  let formatted = aiResponse.replace(/\[Fonte \d+\]/g, '');
  
  // Remove excessive markdown formatting
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold
  formatted = formatted.replace(/\*(.*?)\*/g, '$1'); // Remove italic
  
  // Remove common greetings/closings for more direct responses
  formatted = formatted.replace(/^(Olá|Oi|Bom dia|Boa tarde|Boa noite)[,!]?\s*/i, '');
  formatted = formatted.replace(/\s*(Att|Atenciosamente|Abraços|Obrigado)[.,]?\s*$/i, '');
  
  // Clean up extra whitespace
  formatted = formatted.replace(/\s+/g, ' ').trim();
  
  return formatted;
}

async function upsertWhatsAppConversation(
  instanceId: string,
  connectedPhone: string,
  contactPhone: string,
  contactName: string,
  senderLid: string,
  senderPhoto: string,
  isGroup: boolean,
  messageData: any
) {
  const normalizedContactPhone = normalizePhone(contactPhone);
  const normalizedConnectedPhone = normalizePhone(connectedPhone);
  
  // First, try to get existing conversation
  const { data: existingConversation, error: selectError } = await supabase
    .from('whatsapp_conversas')
    .select('*')
    .eq('instance_id', instanceId)
    .eq('connected_phone', normalizedConnectedPhone)
    .eq('contact_phone', normalizedContactPhone)
    .maybeSingle();

  if (selectError) {
    console.error('Error fetching conversation:', selectError);
    throw selectError;
  }

  const messageTimestamp = new Date(messageData.moment || Date.now()).toISOString();
  const direction = messageData.fromMe ? 'saida' : 'entrada';

  if (existingConversation) {
    // Append message to existing conversation
    const updatedConversa = [...(existingConversation.conversa || []), messageData];
    
    const { data, error } = await supabase
      .from('whatsapp_conversas')
      .update({
        conversa: updatedConversa,
        last_message_at: messageTimestamp,
        last_message_text: messageData.text?.message || '',
        last_direction: direction,
        contact_name: contactName || existingConversation.contact_name,
        sender_photo: senderPhoto || existingConversation.sender_photo,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingConversation.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }

    return data;
  } else {
    // Create new conversation
    const { data, error } = await supabase
      .from('whatsapp_conversas')
      .insert({
        instance_id: instanceId,
        connected_phone: normalizedConnectedPhone,
        contact_phone: normalizedContactPhone,
        contact_name: contactName,
        sender_lid: senderLid,
        sender_photo: senderPhoto,
        is_group: isGroup,
        conversa: [messageData],
        last_message_at: messageTimestamp,
        last_message_text: messageData.text?.message || '',
        last_direction: direction,
        meta: {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }

    return data;
  }
}

async function sendZAPIMessage(phone: string, message: string): Promise<boolean> {
  if (!zapiInstanceId || !zapiToken) {
    console.error('Z-API credentials not configured');
    return false;
  }

  try {
    const response = await fetch(`${zapiBaseUrl}/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });

    if (!response.ok) {
      console.error('Failed to send Z-API message:', await response.text());
      return false;
    }

    console.log('Message sent successfully via Z-API');
    return true;
  } catch (error) {
    console.error('Error sending Z-API message:', error);
    return false;
  }
}

serve(async (req) => {
  console.log(`${req.method} ${req.url}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === 'GET' && req.url.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload: ZAPIMessage = await req.json();
    console.log('Received Z-API webhook:', JSON.stringify(payload, null, 2));

    // Skip status messages and other non-text messages for now
    if (payload.isStatusReply || !payload.text?.message || payload.isGroup) {
      console.log('Skipping message: status reply, no text, or group message');
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert conversation
    const conversation = await upsertWhatsAppConversation(
      payload.instanceId,
      payload.connectedPhone,
      payload.phone,
      payload.chatName || payload.senderName,
      payload.senderLid,
      payload.senderPhoto,
      payload.isGroup,
      {
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
      }
    );

    console.log('Conversation upserted:', conversation.id);

    let sentReply = null;

    // If it's an incoming message (not from us), generate and send AI response
    if (!payload.fromMe && payload.text?.message) {
      try {
        console.log('Generating AI response for message:', payload.text.message);
        
        // Call the existing faq-suggest function
        const { data: aiResponse, error: aiError } = await supabase.functions.invoke('faq-suggest', {
          body: { pergunta: payload.text.message }
        });

        if (aiError) {
          console.error('Error calling faq-suggest:', aiError);
        } else if (aiResponse?.resposta_sugerida) {
          // Format response for franchisee
          const formattedResponse = formatResponseForFranqueado(aiResponse.resposta_sugerida);
          console.log('AI response generated:', formattedResponse);

          // Send response via Z-API
          const sent = await sendZAPIMessage(payload.phone, formattedResponse);
          
          if (sent) {
            sentReply = formattedResponse;
            
            // Also save our response to the conversation
            const responseMessageData = {
              id: `reply_${Date.now()}`,
              from_me: true,
              text: formattedResponse,
              moment: new Date().toISOString(),
              status: 'SENT',
              type: 'SentCallback',
              meta: {
                ai_generated: true,
                original_message: payload.text.message
              }
            };

            await upsertWhatsAppConversation(
              payload.instanceId,
              payload.connectedPhone,
              payload.phone,
              payload.chatName || payload.senderName,
              payload.senderLid,
              payload.senderPhoto,
              payload.isGroup,
              responseMessageData
            );
          }
        }
      } catch (error) {
        console.error('Error processing AI response:', error);
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      conversation_id: conversation.id,
      sent_reply: sentReply 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in zapi-whatsapp function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
