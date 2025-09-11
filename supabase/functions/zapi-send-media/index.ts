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
    console.log('Request body:', JSON.stringify(await req.clone().json(), null, 2));
    
    const { ticketId, attachments } = await req.json();
    
    console.log('📋 Parsed request:', { ticketId, attachmentsCount: attachments?.length });
    
    if (!ticketId || !attachments || !Array.isArray(attachments)) {
      console.error('❌ Invalid request data:', { ticketId, attachments });
      return new Response(
        JSON.stringify({ error: 'ticketId and attachments array are required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Z-API configuration from secrets (same structure as process-notifications)
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_INSTANCE_TOKEN') || Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    const zapiBaseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';

    console.log('=== ENVIRONMENT VARIABLES CHECK ===');
    console.log('All env vars:', Object.keys(Deno.env.toObject()).filter(k => k.startsWith('ZAPI')));
    console.log('ZAPI_INSTANCE_ID:', zapiInstanceId ? `Found (${zapiInstanceId.substring(0, 8)}...)` : 'NOT FOUND');
    console.log('ZAPI_INSTANCE_TOKEN:', Deno.env.get('ZAPI_INSTANCE_TOKEN') ? 'Found' : 'NOT FOUND');
    console.log('ZAPI_TOKEN:', Deno.env.get('ZAPI_TOKEN') ? 'Found' : 'NOT FOUND');
    console.log('ZAPI_CLIENT_TOKEN:', zapiClientToken ? `Found (${zapiClientToken.substring(0, 8)}...)` : 'NOT FOUND');

    console.log('Z-API Configuration Check:', {
      hasInstanceId: !!zapiInstanceId,
      hasToken: !!zapiToken,
      hasClientToken: !!zapiClientToken,
      baseUrl: zapiBaseUrl
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

    // Get ticket details to determine destination
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        id,
        unidade_id,
        franqueado_id
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('Error fetching ticket:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get franqueado details using the franqueado_id
    let destinationPhone = null;
    
    console.log('Ticket details:', { ticketId, franqueado_id: ticket.franqueado_id, unidade_id: ticket.unidade_id });
    
    if (ticket.franqueado_id) {
      const { data: franqueado, error: franqueadoError } = await supabase
        .from('franqueados')
        .select('phone, normalized_phone')
        .eq('id', ticket.franqueado_id)
        .single();
        
      console.log('Franqueado lookup:', { 
        franqueado_id: ticket.franqueado_id, 
        found: !!franqueado,
        error: franqueadoError,
        phone: franqueado?.phone,
        normalized_phone: franqueado?.normalized_phone
      });
        
      if (!franqueadoError && franqueado) {
        destinationPhone = franqueado.normalized_phone || franqueado.phone;
      }
    }
    
    if (!destinationPhone) {
      console.error('No phone number found for ticket');
      return new Response(
        JSON.stringify({ error: 'No destination phone number found' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`=== SENDING ATTACHMENTS ===`);
    console.log(`Ticket ID: ${ticketId}`);
    console.log(`Destination Phone: ${destinationPhone}`);
    console.log(`Number of attachments: ${attachments.length}`);
    console.log(`Attachments details:`, JSON.stringify(attachments, null, 2));

    const results = [];

    // Process each attachment
    for (const attachment of attachments as AttachmentFile[]) {
      try {
        const endpoint = getZApiEndpoint(attachment.type, zapiConfig);
        const payload = buildZApiPayload(attachment, destinationPhone);

        console.log(`Sending ${attachment.type} via ${endpoint}:`, { 
          name: attachment.name, 
          size: attachment.size,
          payload: JSON.stringify(payload, null, 2)
        });

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiConfig.client_token
          },
          body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log(`Z-API Response for ${attachment.name}:`, {
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
          console.log(`Successfully sent ${attachment.name}:`, responseData);
          results.push({
            file: attachment.name,
            success: true,
            zaapId: responseData.zaapId,
            messageId: responseData.messageId
          });
        } else {
          console.error(`Failed to send ${attachment.name}:`, responseData);
          results.push({
            file: attachment.name,
            success: false,
            error: responseData.error || responseText || 'Unknown error'
          });
        }
      } catch (error) {
        console.error(`Error sending ${attachment.name}:`, error);
        results.push({
          file: attachment.name,
          success: false,
          error: error.message
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
    console.error('Error in zapi-send-media:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function getZApiEndpoint(fileType: string, config: ZApiConfig): string {
  const baseUrl = `${config.base_url}/instances/${config.instance_id}/token/${config.instance_token}`;
  
  if (fileType.startsWith('image/')) {
    return `${baseUrl}/send-image`;
  } else if (fileType.startsWith('video/')) {
    return `${baseUrl}/send-video`;
  } else {
    // For documents and audio (as documents for now)
    const extension = getFileExtension(fileType);
    return `${baseUrl}/send-document/${extension}`;
  }
}

function buildZApiPayload(attachment: AttachmentFile, phone: string): any {
  console.log(`=== BUILDING Z-API PAYLOAD ===`);
  console.log(`Phone: ${phone}`);
  console.log(`Attachment Type: ${attachment.type}`);
  console.log(`Attachment URL: ${attachment.url}`);
  console.log(`Attachment Name: ${attachment.name}`);

  if (attachment.type.startsWith('image/')) {
    const payload = {
      phone: phone,
      image: attachment.url,
      caption: attachment.caption || attachment.name,
      viewOnce: false
    };
    console.log(`Image payload:`, JSON.stringify(payload, null, 2));
    return payload;
  } else if (attachment.type.startsWith('video/')) {
    const payload = {
      phone: phone,
      video: attachment.url,
      caption: attachment.caption || attachment.name,
      viewOnce: false
    };
    console.log(`Video payload:`, JSON.stringify(payload, null, 2));
    return payload;
  } else {
    // Documents and audio
    const payload = {
      phone: phone,
      document: attachment.url,
      fileName: attachment.name,
      caption: attachment.caption
    };
    console.log(`Document payload:`, JSON.stringify(payload, null, 2));
    return payload;
  }
}

function getFileExtension(mimeType: string): string {
  const extensions: { [key: string]: string } = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'application/msword': 'doc',
    'text/plain': 'txt',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a'
  };

  return extensions[mimeType] || 'bin';
}