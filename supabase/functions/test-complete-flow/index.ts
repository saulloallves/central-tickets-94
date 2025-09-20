import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧪 Testing complete WhatsApp response flow with buttons');

    // Get the most recent ticket to test with
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, codigo_ticket, titulo')
      .order('created_at', { ascending: false })
      .limit(1);

    if (ticketsError || !tickets || tickets.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No tickets found for testing' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const testTicket = tickets[0];
    console.log(`📋 Testing complete flow with ticket: ${testTicket.codigo_ticket}`);

    const functionsBaseUrl = `https://${Deno.env.get('SUPABASE_URL')?.split('//')[1]}/functions/v1` || 'https://hryurntaljdisohawpqf.supabase.co/functions/v1';
    
    // Step 1: Send resposta_ticket with buttons
    console.log('🚀 Step 1: Sending resposta_ticket with buttons');
    const notificationResponse = await fetch(`${functionsBaseUrl}/send-ticket-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        ticket_id: testTicket.id,
        template_key: 'resposta_ticket'
      })
    });

    const notificationResult = await notificationResponse.json();
    console.log('📤 Step 1 result:', notificationResult);

    // Step 2: Simulate button click "Responder"
    console.log('🚀 Step 2: Simulating button click "Responder"');
    const buttonClickPayload = {
      isStatusReply: false,
      chatLid: null,
      connectedPhone: "5511990235072",
      waitingMessage: false,
      isEdit: false,
      isGroup: true,
      isNewsletter: false,
      instanceId: "3E5FF5355352A0BD49192E30FD8339B1",
      messageId: "TEST_BUTTON_CLICK",
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
        buttonId: `responder_ticket_${testTicket.id}`
      }
    };

    const buttonResponse = await fetch(`${functionsBaseUrl}/zapi-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(buttonClickPayload)
    });

    const buttonResult = await buttonResponse.json();
    console.log('🔘 Step 2 result:', buttonResult);

    // Step 3: Simulate user typing response message
    console.log('🚀 Step 3: Simulating user typing response');
    const userResponsePayload = {
      isStatusReply: false,
      chatLid: null,
      connectedPhone: "5511990235072",
      waitingMessage: false,
      isEdit: false,
      isGroup: true,
      isNewsletter: false,
      instanceId: "3E5FF5355352A0BD49192E30FD8339B1",
      messageId: "TEST_USER_RESPONSE",
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
      text: {
        message: "Esta é minha resposta ao ticket de teste"
      }
    };

    const userResponse = await fetch(`${functionsBaseUrl}/zapi-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(userResponsePayload)
    });

    const userResult = await userResponse.json();
    console.log('💬 Step 3 result:', userResult);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Complete flow test completed',
      ticket_tested: testTicket.codigo_ticket,
      steps: {
        step1_notification: notificationResult,
        step2_button_click: buttonResult,
        step3_user_response: userResult
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error in complete flow test:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});