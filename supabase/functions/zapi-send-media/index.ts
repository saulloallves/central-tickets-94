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

interface AttachmentFile {
  url: string;
  type: string;
  name: string;
  size: number;
  caption?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 === Z-API SEND MEDIA FUNCTION CALLED ===');
    
    const requestBody = await req.json();
    console.log('📨 Full request body:', JSON.stringify(requestBody, null, 2));
    
    const { ticketId, attachments } = requestBody;
    
    console.log('🔍 Validation check:');
    console.log('  - ticketId:', ticketId, '(type:', typeof ticketId, ')');
    console.log('  - attachments:', attachments, '(type:', typeof attachments, ')');
    console.log('  - is array:', Array.isArray(attachments));
    console.log('  - attachments length:', attachments?.length);
    
    if (!ticketId) {
      console.error('❌ ticketId is missing or falsy:', ticketId);
      return new Response(
        JSON.stringify({ error: 'ticketId is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!attachments) {
      console.error('❌ attachments is missing or falsy:', attachments);
      return new Response(
        JSON.stringify({ error: 'attachments is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!Array.isArray(attachments)) {
      console.error('❌ attachments is not an array:', typeof attachments, attachments);
      return new Response(
        JSON.stringify({ error: 'attachments must be an array' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (attachments.length === 0) {
      console.error('❌ attachments array is empty');
      return new Response(
        JSON.stringify({ error: 'attachments array cannot be empty' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ Validation passed - proceeding with media upload');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Z-API configuration from secrets (same structure as process-notifications)
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    const zapiBaseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';

    console.log('=== ENVIRONMENT VARIABLES CHECK ===');
    console.log('All env vars:', Object.keys(Deno.env.toObject()).filter(k => k.startsWith('ZAPI')));
    console.log('ZAPI_INSTANCE_ID:', zapiInstanceId ? `Found (${zapiInstanceId.substring(0, 8)}...)` : 'NOT FOUND');
    console.log('ZAPI_TOKEN:', Deno.env.get('ZAPI_TOKEN') ? 'Found' : 'NOT FOUND');
    console.log('ZAPI_CLIENT_TOKEN:', zapiClientToken ? `Found (${zapiClientToken.substring(0, 8)}...)` : 'NOT FOUND');

    console.log('Z-API Configuration Check:', {
      hasInstanceId: !!zapiInstanceId,
      hasToken: !!zapiToken,
      hasClientToken: !!zapiClientToken,
      baseUrl: zapiBaseUrl
    });

    if (!zapiInstanceId || !zapiToken || !zapiClientToken) {
      console.error('❌ Missing Z-API configuration');
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

    // Get ticket and unidade to find the WhatsApp group
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        id,
        unidade_id,
        codigo_ticket,
        unidades!inner(id_grupo_branco, grupo)
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('❌ Ticket não encontrado:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📋 Ticket details:', {
      ticketId: ticket.id,
      codigo_ticket: ticket.codigo_ticket,
      unidade_id: ticket.unidade_id,
      grupo_nome: ticket.unidades?.grupo
    });

    const grupoWhatsApp = ticket.unidades?.id_grupo_branco;
    
    console.log('🔍 WhatsApp Group Info:', {
      id_grupo_branco: grupoWhatsApp,
      unidade_grupo: ticket.unidades?.grupo,
      has_group: !!grupoWhatsApp
    });
    
    if (!grupoWhatsApp) {
      console.error('❌ Unidade não tem id_grupo_branco configurado');
      return new Response(
        JSON.stringify({ error: 'Unidade sem grupo WhatsApp configurado' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Enviando para grupo:', grupoWhatsApp, '(unidade:', ticket.unidades?.grupo, ')');

    console.log(`📤 Enviando ${attachments.length} anexo(s) para grupo:`, grupoWhatsApp);

    const results = [];

    // Process each attachment
    for (const attachment of attachments as AttachmentFile[]) {
      try {
        // Construir URL diretamente para send-image
        const endpoint = `${zapiConfig.base_url}/instances/${zapiConfig.instance_id}/token/${zapiConfig.instance_token}/send-image`;
        
        const payload = {
          phone: grupoWhatsApp,
          image: attachment.url,
          caption: attachment.caption || attachment.name
        };

        console.log(`📷 Preparing to send image:`, {
          endpoint,
          phone: grupoWhatsApp,
          image: attachment.url,
          name: attachment.name,
          size: attachment.size,
          type: attachment.type
        });

        console.log('🚀 Making Z-API request:', {
          endpoint,
          payload,
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiConfig.client_token.substring(0, 8) + '...'
          }
        });

        // Test image URL accessibility first
        try {
          const imageTest = await fetch(attachment.url, { method: 'HEAD' });
          console.log(`🖼️ Image accessibility test for ${attachment.url}:`, {
            status: imageTest.status,
            contentType: imageTest.headers.get('content-type'),
            contentLength: imageTest.headers.get('content-length')
          });
          
          if (!imageTest.ok) {
            throw new Error(`Image not accessible: ${imageTest.status} ${imageTest.statusText}`);
          }
        } catch (imageError) {
          console.error(`❌ Image accessibility error for ${attachment.url}:`, imageError);
          results.push({
            file: attachment.name,
            success: false,
            error: `Image not accessible: ${imageError.message}`
          });
          continue;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiConfig.client_token
          },
          body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log(`📲 Z-API Response for ${attachment.name}:`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText
        });

        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = { error: `Invalid JSON response: ${responseText}` };
        }

        if (response.ok) {
          console.log(`✅ Successfully sent ${attachment.name}:`, responseData);
          results.push({
            file: attachment.name,
            success: true,
            zaapId: responseData.zaapId,
            messageId: responseData.messageId,
            response: responseData
          });
        } else {
          console.error(`❌ Failed to send ${attachment.name}:`, {
            status: response.status,
            statusText: response.statusText,
            response: responseData,
            payload: payload
          });
          results.push({
            file: attachment.name,
            success: false,
            error: responseData.error || responseData.message || responseText || `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
            response: responseData
          });
        }
      } catch (error) {
        console.error(`❌ Exception sending ${attachment.name}:`, error);
        results.push({
          file: attachment.name,
          success: false,
          error: error.message,
          exception: error.name
        });
      }
    }

    // Log the media sending action
    await supabase.rpc('log_system_action', {
      p_tipo_log: 'acao_humana',
      p_entidade_afetada: 'tickets',
      p_entidade_id: ticketId,
      p_acao_realizada: `Enviados ${attachments.length} anexos via Z-API`,
      p_dados_novos: { 
        attachments: attachments.map(a => ({ name: a.name, type: a.type, size: a.size })),
        results: results
      },
      p_canal: 'zapi'
    });

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`📊 Final results: ${successCount} success, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: successCount,
        failed: failureCount,
        results: results
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in zapi-send-media:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});