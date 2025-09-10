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

    console.log('🧪 Testando configuração de notificações...');

    // Testar uma notificação específica
    const { data: testNotification } = await supabase
      .from('notifications_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('type', 'ticket_created')
      .limit(1)
      .single();

    if (!testNotification) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Nenhuma notificação pendente encontrada para testar' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📋 Testando notificação:', testNotification.id);

    // Buscar dados do ticket
    const { data: ticket } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades (id, grupo, id_grupo_branco)
      `)
      .eq('id', testNotification.ticket_id)
      .single();

    console.log('🎫 Dados do ticket:', {
      id: ticket?.id,
      unidade_id: ticket?.unidade_id,
      id_grupo_branco: ticket?.unidades?.id_grupo_branco
    });

    // Verificar source configuration
    const { data: sourceConfig } = await supabase
      .from('notification_source_config')
      .select('*')
      .eq('notification_type', 'ticket_created')
      .eq('is_active', true)
      .maybeSingle();

    console.log('⚙️ Source config:', sourceConfig);

    // Verificar notification routes
    const { data: routes } = await supabase
      .from('notification_routes')
      .select('*')
      .eq('type', 'ticket_created')
      .eq('is_active', true);

    console.log('📍 Notification routes:', routes);

    // Verificar Z-API config
    const { data: zapiConfig } = await supabase
      .from('messaging_providers')
      .select('instance_id, base_url, is_active')
      .eq('provider_name', 'zapi')
      .eq('is_active', true)
      .single();

    console.log('📱 Z-API config:', {
      instance_id: zapiConfig?.instance_id,
      base_url: zapiConfig?.base_url,
      is_active: zapiConfig?.is_active
    });

    // Testar qual destino seria usado
    let destination = null;
    
    if (sourceConfig?.source_type === 'column' && sourceConfig.source_table === 'unidades') {
      destination = ticket?.unidades?.id_grupo_branco;
      console.log('📤 Destino seria (via source config):', destination);
    } else if (routes && routes.length > 0) {
      destination = routes[0].destination_value;
      console.log('📤 Destino seria (via routes):', destination);
    }

    // Agora vamos tentar processar esta notificação específica
    console.log('🚀 Tentando processar a notificação...');
    
    const { data: processResult, error: processError } = await supabase.functions.invoke('process-notifications', {
      body: {
        ticketId: testNotification.ticket_id,
        type: testNotification.type,
        ...testNotification.payload
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      notification: testNotification,
      ticket: {
        id: ticket?.id,
        unidade_id: ticket?.unidade_id,
        id_grupo_branco: ticket?.unidades?.id_grupo_branco
      },
      sourceConfig,
      routes,
      zapiConfig: {
        instance_id: zapiConfig?.instance_id,
        has_config: !!zapiConfig
      },
      destination,
      processResult,
      processError
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro no teste:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});