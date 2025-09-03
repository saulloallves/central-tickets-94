import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZApiConfig {
  instance_id: string;
  instance_token: string;
  client_token: string;
  base_url: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message, ticketId } = await req.json();
    
    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: 'phone and message are required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Z-API configuration from environment variables
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_INSTANCE_TOKEN') || Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    const zapiBaseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';

    console.log('Z-API Configuration Check:', {
      hasInstanceId: !!zapiInstanceId,
      hasToken: !!zapiToken,
      hasClientToken: !!zapiClientToken,
      baseUrl: zapiBaseUrl,
      phone,
      messageLength: message.length
    });

    if (!zapiInstanceId || !zapiToken || !zapiClientToken) {
      console.error('Missing Z-API configuration');
      return new Response(
        JSON.stringify({ error: 'Z-API configuration not found' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const zapiConfig: ZApiConfig = {
      instance_id: zapiInstanceId,
      instance_token: zapiToken,
      client_token: zapiClientToken,
      base_url: zapiBaseUrl
    };

    // Clean phone number (remove any non-numeric characters except +)
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    
    if (!cleanPhone || cleanPhone.length < 10) {
      console.error('Invalid phone number:', phone, 'cleaned:', cleanPhone);
      return new Response(
        JSON.stringify({ error: `Invalid phone number: ${phone}` }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct Z-API endpoint URL
    const zapiUrl = `${zapiConfig.base_url}/instances/${zapiConfig.instance_id}/token/${zapiConfig.instance_token}/send-text`;
    
    // Prepare message payload
    const payload = {
      phone: cleanPhone,
      message: message
    };

    console.log('Sending message via Z-API:', {
      url: zapiUrl,
      phone: cleanPhone,
      messagePreview: message.substring(0, 100) + (message.length > 100 ? '...' : '')
    });

    // Send message via Z-API
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiConfig.client_token
      },
      body: JSON.stringify(payload)
    });

    const zapiResult = await zapiResponse.json();
    
    if (!zapiResponse.ok) {
      console.error('Z-API Error:', zapiResult);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send message via Z-API', 
          details: zapiResult 
        }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Message sent successfully:', zapiResult);

    // Log the message sending action to Supabase
    if (ticketId) {
      await supabase.from('logs_de_sistema').insert({
        tipo_log: 'sistema',
        entidade_afetada: 'mensagem_crise',
        entidade_id: ticketId,
        acao_realizada: 'Mensagem enviada via Z-API para crise',
        dados_novos: {
          phone: cleanPhone,
          message_length: message.length,
          zapi_response: zapiResult
        },
        canal: 'zapi'
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        phone: cleanPhone,
        messageId: zapiResult.messageId || zapiResult.id,
        zapiResponse: zapiResult
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in zapi-send-message function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});