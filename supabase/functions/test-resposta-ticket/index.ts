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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧪 Testing resposta_ticket with buttons');

    // Get the most recent ticket to test with
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, codigo_ticket')
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
    console.log(`📋 Testing with ticket: ${testTicket.codigo_ticket}`);

    // Call send-ticket-notification directly
    const functionsBaseUrl = `https://${Deno.env.get('SUPABASE_URL')?.split('//')[1]}/functions/v1` || 'https://hryurntaljdisohawpqf.supabase.co/functions/v1';
    
    const response = await fetch(`${functionsBaseUrl}/send-ticket-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        ticket_id: testTicket.id,
        template_key: 'resposta_ticket',
        texto_resposta: 'Teste de resposta do sistema com timestamp correto.'
      })
    });

    const result = await response.json();
    
    console.log('📤 Response from send-ticket-notification:', result);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Test completed',
      ticket_tested: testTicket.codigo_ticket,
      result: result
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