import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧪 Testing SLA breach notification for ticket:', ticketId);

    // Step 1: Get ticket data with full unit information
    console.log('📋 Step 1: Fetching ticket data...');
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades (id, grupo, id_grupo_azul, id_grupo_branco, id_grupo_vermelho, telefone),
        colaboradores (nome_completo),
        equipes (nome)
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('❌ Error fetching ticket:', ticketError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Ticket not found',
          details: ticketError 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    console.log('✅ Ticket data:', {
      codigo_ticket: ticket.codigo_ticket,
      unidade_id: ticket.unidade_id,
      grupo: ticket.unidades?.grupo,
      id_grupo_branco: ticket.unidades?.id_grupo_branco,
      prioridade: ticket.prioridade,
      status: ticket.status
    });

    // Step 2: Check Z-API configuration
    console.log('🔧 Step 2: Checking Z-API configuration...');
    const { data: zapiConfig, error: zapiError } = await supabase
      .from('messaging_providers')
      .select('*')
      .eq('provider_name', 'zapi')
      .eq('is_active', true)
      .single();

    if (zapiError || !zapiConfig) {
      console.error('❌ Z-API configuration not found:', zapiError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Z-API configuration not found',
          details: zapiError 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log('✅ Z-API Config:', {
      instance_id: zapiConfig.instance_id,
      has_token: !!zapiConfig.instance_token,
      has_client_token: !!zapiConfig.client_token,
      base_url: zapiConfig.base_url
    });

    // Step 3: Check destination number
    console.log('📞 Step 3: Checking destination...');
    const destination = ticket.unidades?.id_grupo_branco;
    
    if (!destination) {
      console.error('❌ No id_grupo_branco found for unit');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No WhatsApp group configured for this unit',
          unit_data: ticket.unidades 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log('✅ Destination found:', destination);

    // Step 4: Prepare SLA breach message
    console.log('📝 Step 4: Preparing SLA breach message...');
    const slaMessage = `🚨 *SLA VENCIDO - TESTE*

📋 *Ticket:* ${ticket.codigo_ticket}
📝 *Título:* ${ticket.titulo || 'Sem título'}
🏢 *Unidade:* ${ticket.unidades?.grupo} (${ticket.unidade_id})
👥 *Equipe:* ${ticket.equipes?.nome || 'Não atribuída'}
📂 *Categoria:* ${ticket.categoria || 'Não informada'}
⚡ *Prioridade:* ${ticket.prioridade}
📊 *Status:* ${ticket.status}

💬 *Problema:*
${ticket.descricao_problema}

🕐 *Aberto em:* ${new Date(ticket.data_abertura).toLocaleString('pt-BR')}
⏰ *Venceu em:* ${ticket.data_limite_sla ? new Date(ticket.data_limite_sla).toLocaleString('pt-BR') : 'Não definido'}

🔥 AÇÃO IMEDIATA NECESSÁRIA!

⚠️ *Este é um teste do sistema de notificações SLA*`;

    // Step 5: Send message via Z-API
    console.log('📤 Step 5: Sending message via Z-API...');
    const endpoint = `${zapiConfig.base_url}/instances/${zapiConfig.instance_id}/token/${zapiConfig.instance_token}/send-text`;
    
    const zapiPayload = {
      phone: destination,
      message: slaMessage
    };

    console.log('📡 Z-API Request:', {
      endpoint: endpoint.replace(zapiConfig.instance_token, '****'),
      payload: {
        phone: zapiPayload.phone,
        message: zapiPayload.message.substring(0, 100) + '...'
      }
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Client-Token': zapiConfig.client_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(zapiPayload),
    });

    const responseData = await response.json();
    console.log('📨 Z-API Response:', {
      status: response.status,
      ok: response.ok,
      data: responseData
    });

    // Step 6: Test using process-notifications function
    console.log('🔄 Step 6: Testing via process-notifications function...');
    const processResponse = await supabase.functions.invoke('process-notifications', {
      body: {
        ticketId: ticket.id,
        type: 'sla_breach'
      }
    });

    console.log('🔄 Process-notifications response:', processResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'SLA notification test completed',
        steps: {
          ticket_found: !!ticket,
          zapi_configured: !!zapiConfig,
          destination_found: !!destination,
          message_prepared: !!slaMessage,
          direct_send: {
            success: response.ok,
            status: response.status,
            response: responseData
          },
          process_function: {
            success: !processResponse.error,
            response: processResponse
          }
        },
        data: {
          ticket: {
            codigo_ticket: ticket.codigo_ticket,
            unidade_id: ticket.unidade_id,
            grupo: ticket.unidades?.grupo
          },
          destination,
          message_preview: slaMessage.substring(0, 200) + '...'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('💥 Test error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});