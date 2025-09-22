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

    console.log('🧪 Testing format response prompt configuration');

    // Buscar configurações atuais do prompt de formatação
    const { data: aiSettings, error: settingsError } = await supabase
      .from('faq_ai_settings')
      .select('prompt_format_response')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching AI settings:', settingsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch AI settings' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Current prompt_format_response:', aiSettings?.prompt_format_response ? 'Configured' : 'Using default');

    // Get a recent ticket to test with
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
    console.log(`📋 Testing format response with ticket: ${testTicket.codigo_ticket}`);

    // Test with a sample response that needs formatting
    const testMessage = "ola voce precisa informar os dados corretos pra gente poder ajudar ok?";
    
    // Call process-response function
    const functionsBaseUrl = `https://${Deno.env.get('SUPABASE_URL')?.split('//')[1]}/functions/v1` || 'https://hryurntaljdisohawpqf.supabase.co/functions/v1';
    
    const response = await fetch(`${functionsBaseUrl}/process-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        ticket_id: testTicket.id,
        usuario_id: '870c6202-d3fc-4b3d-a21a-381eff731740', // Admin user
        mensagem: testMessage
      })
    });

    const result = await response.json();
    
    console.log('📤 Response from process-response:', result);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Format response test completed',
      ticket_tested: testTicket.codigo_ticket,
      original_message: testMessage,
      formatted_response: result.message || result,
      using_custom_prompt: !!aiSettings?.prompt_format_response
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