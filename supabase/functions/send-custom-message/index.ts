import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZApiConfig {
  instanceId: string;
  token: string;
  clientToken: string;
  baseUrl: string;
}

// Buscar configuração Z-API para notificações
async function getZApiConfig(supabase: any): Promise<ZApiConfig | null> {
  try {
    const { data: config } = await supabase
      .from('messaging_providers')
      .select('instance_id, base_url, instance_token, client_token')
      .eq('provider_name', 'send_ticket_notification')
      .eq('is_active', true)
      .single();

    if (config?.instance_id) {
      return {
        instanceId: config.instance_id,
        token: config.instance_token || '',
        clientToken: config.client_token || '',
        baseUrl: config.base_url || 'https://api.z-api.io'
      };
    }

    const instanceId = Deno.env.get('NOTIFICATION_ZAPI_INSTANCE_ID') || Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('NOTIFICATION_ZAPI_TOKEN') || Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('NOTIFICATION_ZAPI_CLIENT_TOKEN') || Deno.env.get('ZAPI_CLIENT_TOKEN');
    const baseUrl = Deno.env.get('NOTIFICATION_ZAPI_BASE_URL') || Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';

    if (instanceId && token && clientToken) {
      console.log('✅ Using Z-API instance:', instanceId);
      return { instanceId, token, clientToken, baseUrl };
    }

    return null;
  } catch (error) {
    console.error('Erro ao buscar config Z-API:', error);
    return null;
  }
}

// Buscar destino do WhatsApp
async function getDestinationNumber(supabase: any, ticket: any): Promise<string | null> {
  try {
    const { data: sourceConfig } = await supabase
      .from('notification_source_config')
      .select('*')
      .eq('notification_type', 'mensagem_customizada')
      .eq('is_active', true)
      .single();

    if (!sourceConfig) {
      console.log('⚠️ Nenhuma configuração encontrada');
      return null;
    }

    if (sourceConfig.source_type === 'column' && sourceConfig.source_table === 'unidades_whatsapp') {
      const filterColumn = sourceConfig.filter_column;
      const filterValueSource = sourceConfig.filter_value_source;
      const sourceColumn = sourceConfig.source_column;

      const parts = filterValueSource.split('.');
      let filterValue = ticket;
      
      for (const part of parts) {
        filterValue = filterValue?.[part];
      }

      if (!filterValue) {
        console.error(`❌ Não foi possível extrair valor de ${filterValueSource}`);
        return null;
      }

      const { data: whatsappData } = await supabase
        .from('unidades_whatsapp')
        .select(sourceColumn)
        .eq(filterColumn, filterValue)
        .maybeSingle();

      if (whatsappData?.[sourceColumn]) {
        console.log(`✅ Número encontrado: ${whatsappData[sourceColumn]}`);
        return whatsappData[sourceColumn];
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Erro ao buscar destino:', error);
    return null;
  }
}

// Enviar mensagem via Z-API
async function sendZapiMessage(phone: string, message: string, config: ZApiConfig): Promise<boolean> {
  try {
    const response = await fetch(`${config.baseUrl}/instances/${config.instanceId}/token/${config.token}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.clientToken,
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar via Z-API:', errorText);
      return false;
    }

    console.log('✅ Mensagem enviada via Z-API');
    return true;
  } catch (error) {
    console.error('Erro no envio Z-API:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { ticket_id, custom_message, user_id } = await req.json();

    if (!ticket_id || !custom_message) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ticket_id e custom_message são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📨 Enviando mensagem customizada para ticket: ${ticket_id}`);

    // 1. Buscar dados do ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades (id, grupo, codigo_grupo)
      `)
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error('❌ Erro ao buscar ticket:', ticketError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Ticket não encontrado' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Buscar template da mensagem customizada
    const { data: template } = await supabase
      .from('message_templates')
      .select('template_content')
      .eq('template_key', 'mensagem_customizada')
      .eq('is_active', true)
      .single();

    // 3. Preparar mensagem final usando template
    let finalMessage = custom_message;
    
    if (template?.template_content) {
      const timestamp = new Date().toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      finalMessage = template.template_content
        .replace(/\{\{resposta_real\}\}/g, custom_message)
        .replace(/\{\{timestamp\}\}/g, timestamp)
        .replace(/\{\{codigo_ticket\}\}/g, ticket.codigo_ticket || '')
        .replace(/\{\{mensagem_customizada\}\}/g, custom_message);
    }

    console.log('💬 Mensagem preparada:', finalMessage.substring(0, 200));

    // 4. Buscar destino
    const destination = await getDestinationNumber(supabase, ticket);
    if (!destination) {
      console.error('❌ Destino não encontrado');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Destino não configurado para esta unidade' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📱 Destino:', destination);

    // 5. Buscar configuração Z-API
    const zapiConfig = await getZApiConfig(supabase);
    if (!zapiConfig) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Configuração Z-API não encontrada' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 6. Enviar mensagem
    const sent = await sendZapiMessage(destination, finalMessage, zapiConfig);

    if (!sent) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Falha no envio via Z-API' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 7. Salvar no histórico do ticket (usando SERVICE_ROLE para bypass RLS)
    const { error: insertError } = await supabase
      .from('ticket_mensagens')
      .insert({
        ticket_id: ticket_id,
        usuario_id: user_id,
        mensagem: custom_message, // Salvar apenas a mensagem customizada, sem o template
        direcao: 'saida',
        canal: 'web',
        anexos: []
      });

    if (insertError) {
      console.error('⚠️ Erro ao salvar no histórico:', insertError);
      // Não retornar erro, mensagem já foi enviada
    } else {
      console.log('✅ Mensagem salva no histórico');
    }

    // 8. Log do envio
    await supabase.from('escalation_logs').insert({
      ticket_id: ticket_id,
      event_type: 'custom_message_sent',
      canal: 'zapi',
      message: finalMessage.substring(0, 500),
      response: { success: true, destination }
    });

    console.log('✅ Mensagem customizada enviada e salva com sucesso');
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Mensagem customizada enviada e salva com sucesso',
      destination,
      ticket_code: ticket.codigo_ticket
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro geral:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
