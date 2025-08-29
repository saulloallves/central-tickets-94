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
    const { ticketId, attachments } = await req.json();
    
    if (!ticketId || !attachments || !Array.isArray(attachments)) {
      return new Response(
        JSON.stringify({ error: 'ticketId and attachments array are required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Z-API configuration from secrets
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    const zapiBaseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';

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
    
    if (ticket.franqueado_id) {
      const { data: franqueado, error: franqueadoError } = await supabase
        .from('franqueados')
        .select('phone, normalized_phone')
        .eq('id', ticket.franqueado_id)
        .single();
        
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

    console.log(`Sending ${attachments.length} attachments to ${destinationPhone} for ticket ${ticketId}`);

    const results = [];

    // Process each attachment
    for (const attachment of attachments as AttachmentFile[]) {
      try {
        const endpoint = getZApiEndpoint(attachment.type, zapiConfig);
        const payload = buildZApiPayload(attachment, destinationPhone);

        console.log(`Sending ${attachment.type} via ${endpoint}:`, { 
          name: attachment.name, 
          size: attachment.size 
        });

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiConfig.client_token
          },
          body: JSON.stringify(payload)
        });

        const responseData = await response.json();

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
            error: responseData.error || 'Unknown error'
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
  const basePayload = { phone };

  if (attachment.type.startsWith('image/')) {
    return {
      ...basePayload,
      image: attachment.url,
      caption: attachment.caption || attachment.name,
      viewOnce: false
    };
  } else if (attachment.type.startsWith('video/')) {
    return {
      ...basePayload,
      video: attachment.url,
      caption: attachment.caption || attachment.name,
      viewOnce: false
    };
  } else {
    // Documents and audio
    return {
      ...basePayload,
      document: attachment.url,
      fileName: attachment.name,
      caption: attachment.caption
    };
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