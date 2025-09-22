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

// Função para buscar template da base
async function getMessageTemplate(supabase: any, templateKey: string): Promise<string> {
  const { data: template } = await supabase
    .from('message_templates')
    .select('template_content')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single();

  if (template?.template_content) {
    return template.template_content;
  }

  // Template padrão para ticket_created
  const defaultTemplates: Record<string, string> = {
    'ticket_created': `🎫 *Ticket #{{codigo_ticket}}*
📂 {{categoria}} | ⚡ {{prioridade}}
📄 {{titulo_ticket}}

🏢 *Unidade:* {{unidade_id}}

*Ações disponíveis:*`
  };

  return defaultTemplates[templateKey] || 'Novo ticket: {{codigo_ticket}}';
}

// Função para processar template com variáveis
function processTemplate(template: string, variables: Record<string, any>): string {
  let processed = template;
  
  // Debug log para verificar se o timestamp está sendo processado
  console.log('🔧 Variáveis para processamento:', Object.keys(variables));
  console.log('🕐 Timestamp a ser usado:', variables.timestamp);
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const displayValue = formatDisplayValue(key, value);
    
    // Log específico para timestamp
    if (key === 'timestamp') {
      console.log(`🔄 Substituindo ${placeholder} por ${displayValue}`);
    }
    
    processed = processed.replace(new RegExp(placeholder, 'g'), displayValue);
  }
  
  // Verificar se ainda tem placeholder não substituído
  const remainingPlaceholders = processed.match(/\{\{[^}]+\}\}/g);
  if (remainingPlaceholders) {
    console.warn('⚠️ Placeholders não substituídos:', remainingPlaceholders);
  }
  
  return processed;
}

// Função para formatar valores de exibição
function formatDisplayValue(key: string, value: any): string {
  if (value === null || value === undefined) return '';
  
  const formatters: Record<string, (val: any) => string> = {
    prioridade: (val) => {
      const prioMap: Record<string, string> = {
        'baixa': 'Baixa',
        'baixo': 'Baixo',
        'normal': 'Normal', 
        'alta': 'Alta',
        'alto': 'Alto',
        'medio': 'Médio',
        'imediato': 'Imediato',
        'critica': 'Crítica',
        'critico': 'Crítico',
        'crise': 'Crise'
      };
      return prioMap[val?.toLowerCase()] || val;
    },
    status: (val) => {
      const statusMap: Record<string, string> = {
        'aberto': 'Aberto',
        'em_atendimento': 'Em Atendimento',
        'escalonado': 'Escalonado',
        'concluido': 'Concluído'
      };
      return statusMap[val] || val;
    },
    categoria: (val) => val || 'Não categorizado',
    timestamp: (val) => val // Preservar timestamp já formatado
  };
  
  return formatters[key] ? formatters[key](value) : String(value);
}

// Função para buscar destino usando configuração existente
async function getDestinationNumber(supabase: any, type: string, ticket: any): Promise<string | null> {
  try {
    // Buscar configuração de source para o tipo de notificação
    const { data: sourceConfig } = await supabase
      .from('notification_source_config')
      .select('*')
      .eq('notification_type', type)
      .eq('is_active', true)
      .single();

    if (sourceConfig?.source_type === 'column' && sourceConfig.source_table === 'unidades') {
      // Buscar o número do grupo da unidade
      const { data: unidade } = await supabase
        .from('unidades')
        .select('id_grupo_branco')
        .eq('id', ticket.unidade_id)
        .single();

      return unidade?.id_grupo_branco || null;
    }

    // Fallback: buscar nas notification_routes
    const { data: routes } = await supabase
      .from('notification_routes')
      .select('destination_value')
      .eq('type', type)
      .eq('is_active', true)
      .limit(1);

    return routes?.[0]?.destination_value || null;
  } catch (error) {
    console.error('Erro ao buscar destino:', error);
    return null;
  }
}

// Função para buscar configuração Z-API - NOTIFICAÇÕES
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

    // Fallback para env vars de notificação específicas
    const instanceId = Deno.env.get('NOTIFICATION_ZAPI_INSTANCE_ID') || Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('NOTIFICATION_ZAPI_TOKEN') || Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('NOTIFICATION_ZAPI_CLIENT_TOKEN') || Deno.env.get('ZAPI_CLIENT_TOKEN');
    const baseUrl = Deno.env.get('NOTIFICATION_ZAPI_BASE_URL') || Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';

    if (instanceId && token && clientToken) {
      console.log('✅ Using NOTIFICATION Z-API instance:', instanceId);
      return { instanceId, token, clientToken, baseUrl };
    }

    return null;
  } catch (error) {
    console.error('Erro ao buscar config Z-API de notificação:', error);
    return null;
  }
}

// Função para enviar mensagem via Z-API (sempre texto simples)
async function sendZapiMessage(phone: string, message: string, config: ZApiConfig): Promise<boolean> {
  try {
    // Sempre enviar como texto simples, sem botões
    const body = JSON.stringify({
      phone: phone,
      message: message,
    });

    const response = await fetch(`${config.baseUrl}/instances/${config.instanceId}/token/${config.token}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.clientToken,
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar via Z-API:', errorText);
      return false;
    }

    console.log('✅ Mensagem enviada via Z-API com sucesso');
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

    const { ticket_id, template_key = 'ticket_created', resposta_real } = await req.json();

    if (!ticket_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ticket_id é obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📨 Processando notificação para ticket: ${ticket_id}`);

    // 1. Buscar dados completos do ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades (id, grupo, id_grupo_branco),
        equipes (nome),
        colaboradores (nome_completo)
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

    // 2. Buscar template da base
    const template = await getMessageTemplate(supabase, template_key);
    console.log('📋 Template encontrado:', template_key);

    // 3. Preparar variáveis para o template
    const variables = {
      codigo_ticket: ticket.codigo_ticket,
      titulo_ticket: ticket.titulo,
      categoria: ticket.categoria,
      prioridade: ticket.prioridade,
      status: ticket.status,
      unidade_id: ticket.unidade_id,
      unidade_nome: ticket.unidades?.grupo || ticket.unidade_id,
      equipe_nome: ticket.equipes?.nome || 'Não definida',
      equipe_responsavel: ticket.equipes?.nome || 'Não definida',
      colaborador_nome: ticket.colaboradores?.nome_completo || 'Não definido',
      colaborador_responsavel: ticket.colaboradores?.nome_completo || 'Não definido',
      descricao_problema: ticket.descricao_problema || 'Não informado',
      data_criacao: new Date(ticket.created_at).toLocaleString('pt-BR'),
      data_abertura: new Date(ticket.data_abertura || ticket.created_at).toLocaleString('pt-BR'),
      data_limite_sla: ticket.data_limite_sla ? new Date(ticket.data_limite_sla).toLocaleString('pt-BR') : 'Não definido',
      // Variáveis específicas para resposta_ticket
      texto_resposta: resposta_real || 'Resposta disponível no sistema de atendimento',
      timestamp: new Date().toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    };

    // 4. Processar template
    console.log('🕐 Timestamp gerado:', variables.timestamp);
    const message = processTemplate(template, variables);
    console.log('💬 Mensagem processada:', message.substring(0, 200) + '...');

    // 5. Buscar destino
    const destination = await getDestinationNumber(supabase, template_key, ticket);
    if (!destination) {
      console.error('❌ Destino não encontrado para o ticket');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Destino não configurado para esta unidade' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📱 Destino encontrado:', destination);

    // 6. Buscar configuração Z-API
    const zapiConfig = await getZApiConfig(supabase);
    if (!zapiConfig) {
      console.error('❌ Configuração Z-API não encontrada');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Configuração Z-API não encontrada' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 7. Enviar mensagem (sempre sem botões)
    const sent = await sendZapiMessage(destination, message, zapiConfig);

    // 8. Log do resultado
    await supabase.from('escalation_logs').insert({
      ticket_id: ticket_id,
      event_type: 'notification_sent',
      canal: 'zapi',
      message: message.substring(0, 500),
      response: { success: sent, destination, template_key }
    });

    if (sent) {
      console.log('✅ Notificação enviada com sucesso');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Notificação enviada com sucesso',
        destination,
        ticket_code: ticket.codigo_ticket
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      console.error('❌ Falha no envio da notificação');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Falha no envio via Z-API' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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