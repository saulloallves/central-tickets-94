import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ZApiConfig {
  instanceId: string;
  instanceToken: string; 
  clientToken: string;
  baseUrl: string;
}

interface MessageTemplate {
  template_content: string;
  variables: string[];
}

interface NotificationRoute {
  id: string;
  type: string;
  destination_value: string;
  destination_label?: string;
  unit_id?: string;
  priority: number;
  is_active: boolean;
}

// Get notification route for a specific type and unit
async function getNotificationRoute(supabase: any, type: string, unitId?: string): Promise<string | null> {
  try {
    // First try to find unit-specific route
    if (unitId) {
      const { data: unitRoute, error: unitError } = await supabase
        .from('notification_routes')
        .select('destination_value')
        .eq('type', type)
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1)
        .single();

      if (!unitError && unitRoute) {
        console.log(`Using unit-specific route for ${type} in ${unitId}: ${unitRoute.destination_value}`);
        return unitRoute.destination_value;
      }
    }

    // Fallback to global route
    const { data: globalRoute, error: globalError } = await supabase
      .from('notification_routes')
      .select('destination_value')
      .eq('type', type)
      .is('unit_id', null)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    if (!globalError && globalRoute) {
      console.log(`Using global route for ${type}: ${globalRoute.destination_value}`);
      return globalRoute.destination_value;
    }
  } catch (error) {
    console.log(`No custom route found for ${type}, falling back to default logic`);
  }

  return null;
}

// Get Z-API configuration from database or fallback to secrets
async function getZApiConfig(supabase: any): Promise<ZApiConfig | null> {
  try {
    const { data, error } = await supabase
      .from('messaging_providers')
      .select('instance_id, instance_token, client_token, base_url')
      .eq('provider_name', 'zapi')
      .eq('is_active', true)
      .single();

    if (!error && data) {
      console.log('Using Z-API configuration from database');
      return {
        instanceId: data.instance_id,
        instanceToken: data.instance_token,
        clientToken: data.client_token,
        baseUrl: data.base_url
      };
    }
  } catch (dbError) {
    console.log('Database config not found, using environment secrets');
  }

  // Fallback to environment secrets
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const instanceToken = Deno.env.get('ZAPI_INSTANCE_TOKEN') || Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
  const baseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';

  if (!instanceId || !instanceToken || !clientToken) {
    console.error('Missing required Z-API configuration');
    return null;
  }

  console.log('Using Z-API configuration from environment secrets');
  return {
    instanceId,
    instanceToken,
    clientToken,
    baseUrl
  };
}

// Get message template from database or use default
async function getMessageTemplate(supabase: any, templateKey: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('message_templates')
      .select('template_content, variables')
      .eq('template_key', templateKey)
      .eq('is_active', true)
      .single();

    if (!error && data) {
      console.log(`Using template from database for: ${templateKey}`);
      return data.template_content;
    }
  } catch (dbError) {
    console.log(`Template not found in database for ${templateKey}, using default`);
  }

  // Default templates as fallback
  const defaultTemplates: Record<string, string> = {
    'ticket_created': `🎫 *NOVO TICKET CRIADO*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}

💬 *Problema:*
{{descricao_problema}}

🕐 *Aberto em:* {{data_abertura}}`,

    'resposta_ticket': `💬 *RESPOSTA DO TICKET*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}

📝 *Resposta:*
{{texto_resposta}}

🕐 *Respondido em:* {{timestamp}}`,

    'resposta_ticket_franqueado': `💬 *RESPOSTA DO SEU TICKET*

📋 *Ticket:* {{codigo_ticket}}
📝 *Resposta:*
{{texto_resposta}}

🕐 *Respondido em:* {{timestamp}}

Para mais detalhes, acesse o sistema.`,

    'sla_half': `⚠️ *ALERTA SLA - 50%*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}
⏰ *Prazo limite:* {{data_limite_sla}}

⚡ Atenção necessária!`,

    'sla_breach': `🚨 *SLA VENCIDO*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}
⏰ *Venceu em:* {{data_limite_sla}}

🔥 AÇÃO IMEDIATA NECESSÁRIA!`,

    'crisis': `🆘 *CRISE ATIVADA*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}
💥 *Motivo:* {{motivo}}

🚨 TODOS OS RECURSOS MOBILIZADOS!`
  };

  return defaultTemplates[templateKey] || 'Template não configurado';
}

// Replace template variables with actual values
function processTemplate(template: string, variables: Record<string, any>): string {
  let processed = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    processed = processed.replace(new RegExp(placeholder, 'g'), String(value || ''));
  }
  
  return processed;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { ticketId, type, textoResposta, testPhone } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Handle test connection separately (no ticket needed)
    if (type === 'test_connection') {
      console.log('Testing Z-API connection');
      
      // Get Z-API configuration
      const zapiConfig = await getZApiConfig(supabase);
      if (!zapiConfig) {
        throw new Error('Missing required Z-API configuration');
      }

      // Test connection with a simple endpoint check or send test message
      if (testPhone) {
        console.log('Sending test message to:', testPhone);
        const normalizePhoneNumber = (phone: any): string | null => {
          if (!phone) return null;
          let phoneStr = phone.toString().replace(/\D/g, '');
          if (phoneStr.length === 13 && phoneStr.startsWith('55')) return phoneStr;
          if (phoneStr.length === 11) return '55' + phoneStr;
          if (phoneStr.length === 10) return '55' + phoneStr.charAt(0) + phoneStr.charAt(1) + '9' + phoneStr.substring(2);
          return phoneStr.length >= 10 ? phoneStr : null;
        };

        const endpoint = `${zapiConfig.baseUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.instanceToken}/send-text`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Client-Token': zapiConfig.clientToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: normalizePhoneNumber(testPhone),
            message: textoResposta || '✅ Teste de conexão Z-API realizado com sucesso!'
          }),
        });

        const responseData = await response.json();
        console.log('Test response:', responseData);

        return new Response(
          JSON.stringify({
            success: response.ok,
            message: response.ok ? 'Teste realizado com sucesso!' : 'Erro no teste de conexão',
            data: responseData
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.ok ? 200 : 400
          }
        );
      } else {
        // Just test credentials validity without sending message
        const endpoint = `${zapiConfig.baseUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.instanceToken}/status`;
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Client-Token': zapiConfig.clientToken,
          },
        });

        const responseData = await response.json();
        console.log('Status check response:', responseData);

        return new Response(
          JSON.stringify({
            success: response.ok,
            message: response.ok ? 'Credenciais Z-API válidas!' : 'Erro nas credenciais Z-API',
            data: responseData
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.ok ? 200 : 400
          }
        );
      }
    }

    // For other notification types, fetch ticket data
    console.log('Fetching ticket data for ID:', ticketId)
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades (id, grupo, id_grupo_azul, id_grupo_branco, id_grupo_vermelho, telefone),
        colaboradores (nome_completo)
      `)
      .eq('id', ticketId)
      .single()

    if (ticketError || !ticket) {
      console.error('Ticket error:', ticketError)
      return new Response(
        JSON.stringify({ success: false, message: 'Ticket não encontrado' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
    
    console.log('Ticket found:', {
      id: ticket.id,
      codigo: ticket.codigo_ticket,
      franqueado_id: ticket.franqueado_id
    })

    // Função para buscar franqueado (solicitante) baseado no ticket
    const getFranqueadoSolicitante = async (ticket: any) => {
      let franqueado = null
      
      // Tentativa 1: Se tem franqueado_id, buscar por ID
      if (ticket.franqueado_id) {
        console.log('Fetching franqueado by ID:', ticket.franqueado_id)
        const { data: franqueadoData, error: franqueadoError } = await supabase
          .from('franqueados')
          .select('name, phone, email')
          .eq('id', ticket.franqueado_id)
          .single()
        
        if (!franqueadoError && franqueadoData) {
          franqueado = franqueadoData
          console.log('Franqueado found by ID:', { name: franqueado?.name, hasPhone: !!franqueado?.phone })
          return franqueado
        }
      }
      
      // Tentativa 2: Se não tem franqueado_id ou não encontrou, buscar por email do criador
      if (ticket.criado_por) {
        console.log('Fetching profile email for user:', ticket.criado_por)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', ticket.criado_por)
          .single()
        
        if (!profileError && profileData?.email) {
          console.log('Profile email found:', profileData.email)
          const { data: franqueadoData, error: franqueadoError } = await supabase
            .from('franqueados')
            .select('name, phone, email')
            .eq('email', profileData.email)
            .single()
          
          if (!franqueadoError && franqueadoData) {
            franqueado = franqueadoData
            console.log('Franqueado found by email:', { name: franqueado?.name, hasPhone: !!franqueado?.phone })
            return franqueado
          }
        }
      }
      
      console.log('No franqueado found for ticket')
      return null
    }

    // Get Z-API configuration from database or environment
    const zapiConfig = await getZApiConfig(supabase);
    if (!zapiConfig) {
      throw new Error('Missing required Z-API configuration');
    }

    // Função para formatar o título do ticket
    const formatTicketTitle = (ticket: any) => {
      const titulo = ticket.titulo || 'Problema reportado'
      const codigo = ticket.codigo_ticket
      return `${titulo} (${codigo})`
    }

    // Função para normalizar número de telefone
    const normalizePhoneNumber = (phone: any): string | null => {
      if (!phone) return null
      
      let phoneStr = phone.toString().replace(/\D/g, '') // Remove tudo que não é dígito
      
      // Se tem 13 dígitos e começa com 55, já tem código do país
      if (phoneStr.length === 13 && phoneStr.startsWith('55')) {
        return phoneStr
      }
      
      // Se tem 11 dígitos, adiciona código do país (55)
      if (phoneStr.length === 11) {
        return '55' + phoneStr
      }
      
      // Se tem 10 dígitos, adiciona 9 e código do país
      if (phoneStr.length === 10) {
        return '55' + phoneStr.charAt(0) + phoneStr.charAt(1) + '9' + phoneStr.substring(2)
      }
      
      console.warn('Phone number format not recognized:', phone)
      return phoneStr.length >= 10 ? phoneStr : null
    }

    // Função para enviar mensagem via ZAPI
    const sendZapiMessage = async (destino: string, texto: string) => {
      const endpoint = `${zapiConfig.baseUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.instanceToken}/send-text`;
      console.log(`Using endpoint: ${endpoint.replace(zapiConfig.instanceToken, '****')}`);
      
      const zapiPayload = {
        phone: destino,
        message: texto
      };
      
      console.log('Sending to ZAPI:', zapiPayload);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Client-Token': zapiConfig.clientToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(zapiPayload),
      });

      console.log(`ZAPI response status: ${response.status}`);
      const responseData = await response.json();
      console.log('ZAPI response:', responseData);

      return { success: response.ok, data: responseData };
    };

    let resultadoEnvio: any = { success: false };
    let destinoFinal: string = '';

    // Get custom route for this notification type
    const customRoute = await getNotificationRoute(supabase, type, ticket.unidade_id);

    switch (type) {
      case 'ticket_criado':
        console.log('Processing ticket_criado - checking for custom route');
        
        if (customRoute) {
          destinoFinal = customRoute;
          console.log(`Using custom route for ticket_criado: ${destinoFinal}`);
        } else if (ticket.unidades?.id_grupo_branco) {
          destinoFinal = ticket.unidades.id_grupo_branco;
          console.log(`Using default group for ticket_criado: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma rota configurada para ticket_criado na unidade ${ticket.unidade_id}`);
        }

        const templateTicket = await getMessageTemplate(supabase, 'ticket_created');
        const mensagemTicket = processTemplate(templateTicket, {
          codigo_ticket: formatTicketTitle(ticket),
          unidade_id: ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          descricao_problema: ticket.descricao_problema,
          data_abertura: new Date(ticket.data_abertura).toLocaleString('pt-BR')
        });

        resultadoEnvio = await sendZapiMessage(normalizePhoneNumber(destinoFinal), mensagemTicket);
        break;

      case 'resposta_ticket':
        console.log('Processing resposta_ticket - checking for custom route');
        
        if (customRoute) {
          destinoFinal = customRoute;
          console.log(`Using custom route for resposta_ticket: ${destinoFinal}`);
        } else if (ticket.unidades?.id_grupo_branco) {
          destinoFinal = ticket.unidades.id_grupo_branco;
          console.log(`Using default group for resposta_ticket: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma rota configurada para resposta_ticket na unidade ${ticket.unidade_id}`);
        }

        const templateResposta = await getMessageTemplate(supabase, 'resposta_ticket');
        const mensagemResposta = processTemplate(templateResposta, {
          codigo_ticket: formatTicketTitle(ticket),
          unidade_id: ticket.unidade_id,
          texto_resposta: textoResposta,
          timestamp: new Date().toLocaleString('pt-BR')
        });

        resultadoEnvio = await sendZapiMessage(normalizePhoneNumber(destinoFinal), mensagemResposta);
        break;

      case 'resposta_ticket_franqueado':
      case 'resposta_ticket_privado':
        console.log(`Processing ${type} - sending to franqueado (solicitante) phone`);
        
        const franqueadoSolicitante = await getFranqueadoSolicitante(ticket);
        if (!franqueadoSolicitante || !franqueadoSolicitante.phone) {
          throw new Error('Telefone do franqueado (solicitante) não configurado');
        }

        console.log(`Sending message to franqueado (solicitante) phone: ${franqueadoSolicitante.phone}`);

        const templateFranqueado = await getMessageTemplate(supabase, 'resposta_ticket_franqueado');
        const mensagemFranqueado = processTemplate(templateFranqueado, {
          codigo_ticket: formatTicketTitle(ticket),
          texto_resposta: textoResposta,
          timestamp: new Date().toLocaleString('pt-BR')
        });

        resultadoEnvio = await sendZapiMessage(franqueadoSolicitante.phone, mensagemFranqueado);
        destinoFinal = franqueadoSolicitante.phone;
        break;

      case 'sla_half':
        console.log('Processing sla_half - checking for custom route');
        
        if (customRoute) {
          destinoFinal = customRoute;
          console.log(`Using custom route for sla_half: ${destinoFinal}`);
        } else if (ticket.unidades?.id_grupo_branco) {
          destinoFinal = ticket.unidades.id_grupo_branco;
          console.log(`Using default group for sla_half: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma rota configurada para sla_half na unidade ${ticket.unidade_id}`);
        }

        const templateSLAHalf = await getMessageTemplate(supabase, 'sla_half');
        const mensagemSLAHalf = processTemplate(templateSLAHalf, {
          codigo_ticket: formatTicketTitle(ticket),
          unidade_id: ticket.unidade_id,
          data_limite_sla: new Date(ticket.data_limite_sla).toLocaleString('pt-BR')
        });

        resultadoEnvio = await sendZapiMessage(normalizePhoneNumber(destinoFinal), mensagemSLAHalf);
        break;

      case 'sla_breach':
        console.log('Processing sla_breach - checking for custom route');
        
        if (customRoute) {
          destinoFinal = customRoute;
          console.log(`Using custom route for sla_breach: ${destinoFinal}`);
        } else if (ticket.unidades?.id_grupo_branco) {
          destinoFinal = ticket.unidades.id_grupo_branco;
          console.log(`Using default group for sla_breach: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma rota configurada para sla_breach na unidade ${ticket.unidade_id}`);
        }

        const templateSLABreach = await getMessageTemplate(supabase, 'sla_breach');
        const mensagemSLABreach = processTemplate(templateSLABreach, {
          codigo_ticket: formatTicketTitle(ticket),
          unidade_id: ticket.unidade_id,
          data_limite_sla: new Date(ticket.data_limite_sla).toLocaleString('pt-BR')
        });

        resultadoEnvio = await sendZapiMessage(normalizePhoneNumber(destinoFinal), mensagemSLABreach);
        break;

      case 'crisis':
        console.log('Processing crisis - checking for custom route');
        
        if (customRoute) {
          destinoFinal = customRoute;
          console.log(`Using custom route for crisis: ${destinoFinal}`);
        } else if (ticket.unidades?.id_grupo_branco) {
          destinoFinal = ticket.unidades.id_grupo_branco;
          console.log(`Using default group for crisis: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma rota configurada para crisis na unidade ${ticket.unidade_id}`);
        }

        const motivo = textoResposta || 'Não informado';
        const templateCrise = await getMessageTemplate(supabase, 'crisis');
        const mensagemCrise = processTemplate(templateCrise, {
          codigo_ticket: formatTicketTitle(ticket),
          unidade_id: ticket.unidade_id,
          motivo: motivo
        });

        resultadoEnvio = await sendZapiMessage(normalizePhoneNumber(destinoFinal), mensagemCrise);
        break;

      case 'crisis_resolved':
        console.log('Processing crisis_resolved - checking for custom route');
        
        if (customRoute) {
          destinoFinal = customRoute;
          console.log(`Using custom route for crisis_resolved: ${destinoFinal}`);
        } else if (ticket.unidades?.id_grupo_branco) {
          destinoFinal = ticket.unidades.id_grupo_branco;
          console.log(`Using default group for crisis_resolved: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma rota configurada para crisis_resolved na unidade ${ticket.unidade_id}`);
        }

        const templateCriseResolvida = `✅ *CRISE RESOLVIDA*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}

🎯 A crise foi oficialmente resolvida!`;

        const mensagemCriseResolvida = processTemplate(templateCriseResolvida, {
          codigo_ticket: formatTicketTitle(ticket),
          unidade_id: ticket.unidade_id
        });

        resultadoEnvio = await sendZapiMessage(normalizePhoneNumber(destinoFinal), mensagemCriseResolvida);
        break;

      case 'crisis_update':
        console.log('Processing crisis_update - checking for custom route');
        
        if (customRoute) {
          destinoFinal = customRoute;
          console.log(`Using custom route for crisis_update: ${destinoFinal}`);
        } else if (ticket.unidades?.id_grupo_branco) {
          destinoFinal = ticket.unidades.id_grupo_branco;
          console.log(`Using default group for crisis_update: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma rota configurada para crisis_update na unidade ${ticket.unidade_id}`);
        }

        const templateCriseUpdate = `🔄 *ATUALIZAÇÃO DE CRISE*

📋 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}
🔄 *Ação:* {{acao}}

ℹ️ Nova ação registrada na crise.`;

        const mensagemCriseUpdate = processTemplate(templateCriseUpdate, {
          codigo_ticket: formatTicketTitle(ticket),
          unidade_id: ticket.unidade_id,
          acao: textoResposta || 'Não informado'
        });

        resultadoEnvio = await sendZapiMessage(normalizePhoneNumber(destinoFinal), mensagemCriseUpdate);
        break;

      default:
        throw new Error(`Tipo de notificação não implementado: ${type}`);
    }

    // Log the result
    console.log(`Notification sent to: ${destinoFinal.replace(/(\d{4})\d+(\d{4})/, '$1***$2')}`);
    console.log('Send result:', { success: resultadoEnvio.success, status: resultadoEnvio.status });

    // Registrar log do envio
    await supabase
      .from('escalation_logs')
      .insert({
        ticket_id: ticketId,
        event_type: type,
        message: `WhatsApp notification sent to ${destinoFinal}`,
        response: resultadoEnvio,
        canal: 'zapi'
      });

    return new Response(
      JSON.stringify({
        success: resultadoEnvio.success,
        message: resultadoEnvio.success 
          ? `Mensagem enviada com sucesso para ${destinoFinal.replace(/(\d{4})\d+(\d{4})/, '$1***$2')}` 
          : resultadoEnvio.error || 'Erro ao enviar mensagem',
        data: resultadoEnvio.data,
        destination: destinoFinal.replace(/(\d{4})\d+(\d{4})/, '$1***$2')
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: resultadoEnvio.success ? 200 : 400
      }
    );

  } catch (error) {
    console.error('Error in process-notifications:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        message: `Erro no processamento: ${error.message}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
