// Using native Deno.serve (no import needed)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testing button click simulation');

    // Simulate a button click from WhatsApp
    const testButtonPayload = {
      isStatusReply: false,
      chatLid: null,
      connectedPhone: "5511990235072",
      waitingMessage: false,
      isEdit: false,
      isGroup: true,
      isNewsletter: false,
      instanceId: "3E5FF5355352A0BD49192E30FD8339B1",
      messageId: "TEST_MESSAGE_ID",
      phone: "120363258963635302-group",
      fromMe: false,
      momment: Date.now(),
      status: "RECEIVED",
      chatName: "EQUIPES - TESTES DO MAKE / RJ",
      senderPhoto: "https://example.com/photo.jpg",
      senderName: "Test User",
      photo: "https://example.com/group.jpg",
      broadcast: false,
      participantPhone: "5511947876833",
      participantLid: "test@lid",
      forwarded: false,
      type: "ReceivedCallback",
      fromApi: false,
      buttonsResponseMessage: {
        buttonId: "responder_ticket_01193cfc-15b8-442d-8ecd-7c80858473d0"
      }
    };

    console.log('📤 Simulating button click with payload:', JSON.stringify(testButtonPayload, null, 2));

    // Call bot_base_1 first
    const functionsBaseUrl = `https://${Deno.env.get('SUPABASE_URL')?.split('//')[1]}/functions/v1` || 'https://hryurntaljdisohawpqf.supabase.co/functions/v1';
    
    const botResponse = await fetch(`${functionsBaseUrl}/bot_base_1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(testButtonPayload)
    });

    const botResult = await botResponse.text();
    console.log('🤖 Bot response:', botResult);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Button click simulation completed',
      bot_response: botResult,
      bot_status: botResponse.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error in test:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});