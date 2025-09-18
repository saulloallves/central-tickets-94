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

// Get destination number based on notification source configuration
async function getDestinationNumber(supabase: any, type: string, ticket: any): Promise<string | null> {
  try {
    // Get source configuration for this notification type
    const { data: sourceConfig, error: configError } = await supabase
      .from('notification_source_config')
      .select('*')
      .eq('notification_type', type)
      .eq('is_active', true)
      .maybeSingle();

    if (configError) {
      console.error('Error fetching source config:', configError);
      return null;
    }

    if (!sourceConfig) {
      console.log(`No source configuration found for ${type}, using legacy fallback`);
      return getLegacyDestination(type, ticket);
    }

    console.log(`Using source config for ${type}:`, sourceConfig);

    switch (sourceConfig.source_type) {
      case 'fixed':
        if (sourceConfig.fixed_value) {
          console.log(`Using fixed value for ${type}: ${sourceConfig.fixed_value}`);
          return sourceConfig.fixed_value;
        }
        break;

      case 'column':
        if (sourceConfig.source_table && sourceConfig.source_column) {
          const number = await getNumberFromColumn(
            supabase,
            sourceConfig.source_table,
            sourceConfig.source_column,
            ticket
          );
          if (number) {
            console.log(`Got number from ${sourceConfig.source_table}.${sourceConfig.source_column}: ${number}`);
            return number;
          }
        }
        break;

      case 'dynamic':
        console.log('Dynamic source type not implemented yet');
        break;
    }

    console.log(`No number found from source config for ${type}, using legacy fallback`);
    return getLegacyDestination(type, ticket);
  } catch (error) {
    console.error('Error in getDestinationNumber:', error);
    return getLegacyDestination(type, ticket);
  }
}

async function getNumberFromColumn(supabase: any, table: string, column: string, ticket: any): Promise<string | null> {
  try {
    switch (table) {
      case 'unidades':
        if (ticket.unidade_id) {
          const { data, error } = await supabase
            .from('unidades')
            .select(column)
            .eq('id', ticket.unidade_id)
            .maybeSingle();

          if (!error && data && data[column]) {
            return data[column];
          }
        }
        break;

      case 'franqueados':
        if (ticket.unidade_id && column === 'phone') {
          const { data, error } = await supabase
            .from('franqueados')
            .select('phone')
            .contains('unit_code', { [ticket.unidade_id]: true })
            .maybeSingle();

          if (!error && data && data.phone) {
            return data.phone;
          }
        }
        break;

      case 'colaboradores':
        if (ticket.unidade_id && column === 'telefone') {
          const { data, error } = await supabase
            .from('colaboradores')
            .select('telefone')
            .eq('unidade_id', ticket.unidade_id)
            .maybeSingle();

          if (!error && data && data.telefone) {
            return data.telefone;
          }
        }
        break;
    }
  } catch (error) {
    console.error(`Error fetching from ${table}.${column}:`, error);
  }

  return null;
}

// Legacy fallback for when no source configuration is found
function getLegacyDestination(type: string, ticket: any): string | null {
  switch (type) {
    case 'resposta_ticket':
    case 'ticket_created':
    case 'sla_half':
    case 'sla_breach':
    case 'sla_breach':
      return ticket.unidades?.id_grupo_branco || null;
    
    default:
      return null;
  }
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
  const instanceToken = Deno.env.get('ZAPI_TOKEN');
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

  // Default templates as fallback with enriched variables
  const defaultTemplates: Record<string, string> = {
    'ticket_created': `🎫 *NOVO TICKET CRIADO*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
👤 *Responsável:* {{colaborador_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

💬 *Problema:*
{{descricao_problema}}

🕐 *Aberto em:* {{data_abertura}}
⏰ *Prazo SLA:* {{data_limite_sla}}`,

    'resposta_ticket': `💬 *RESPOSTA DO TICKET*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

📝 *Resposta:*
{{texto_resposta}}

🕐 *Respondido em:* {{timestamp}}`,

    'resposta_ticket_franqueado': `💬 *RESPOSTA DO SEU TICKET*

📋 *Ticket:* {{codigo_ticket}}
📝 *Resposta:*
{{texto_resposta}}

🕐 *Respondido em:* {{timestamp}}

Para mais detalhes, acesse o sistema.`,

    'sla_half': `⚠️ *ALERTA SLA - 50% DO PRAZO*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

💬 *Problema:*
{{descricao_problema}}

🕐 *Aberto em:* {{data_abertura}}
⏰ *Prazo limite:* {{data_limite_sla}}

⚡ Atenção necessária!`,

    'sla_breach': `🚨 *SLA VENCIDO*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

💬 *Problema:*
{{descricao_problema}}

🕐 *Aberto em:* {{data_abertura}}
⏰ *Venceu em:* {{data_limite_sla}}

🔥 AÇÃO IMEDIATA NECESSÁRIA!`,

    'crisis': `🚨 *CRISE DETECTADA*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}

💬 *Problema:*
{{descricao_problema}}

🚨 CRISE ATIVADA - ATENÇÃO IMEDIATA!`
  };

  return defaultTemplates[templateKey] || 'Template não configurado';
}

// Replace template variables with actual values
function processTemplate(template: string, variables: Record<string, any>): string {
  let processed = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const formattedValue = formatDisplayValue(key, value);
    processed = processed.replace(new RegExp(placeholder, 'g'), String(formattedValue || ''));
  }
  
  return processed;
}

// Format values for better display in messages
function formatDisplayValue(key: string, value: any): string {
  if (!value) return '';
  
  const valueStr = String(value);
  
  // Format priority values
  if (key === 'prioridade') {
    const prioridadeMap: Record<string, string> = {
      'imediato': 'Imediato',
      'ate_1_hora': 'Até 1 Hora',
      'ainda_hoje': 'Ainda Hoje',
      'posso_esperar': 'Posso Esperar',
      'urgente': 'Urgente',
      'alta': 'Alta',
      'media': 'Média',
      'baixa': 'Baixa',
      'hoje_18h': 'Hoje 18h',
      'padrao_24h': 'Padrão 24h',
      'crise': 'CRISE'
    };
    return prioridadeMap[valueStr] || valueStr;
  }
  
  // Format status values
  if (key === 'status') {
    const statusMap: Record<string, string> = {
      'aberto': 'Aberto',
      'em_atendimento': 'Em Atendimento',
      'aguardando_franqueado': 'Aguardando Franqueado',
      'escalonado': 'Escalonado',
      'concluido': 'Concluído',
      'cancelado': 'Cancelado',
      'pendente': 'Pendente'
    };
    return statusMap[valueStr] || valueStr;
  }
  
  // Format category values
  if (key === 'categoria') {
    const categoriaMap: Record<string, string> = {
      'sistema': 'Sistema',
      'financeiro': 'Financeiro',
      'operacional': 'Operacional',
      'comercial': 'Comercial',
      'juridico': 'Jurídico',
      'marketing': 'Marketing',
      'suporte': 'Suporte',
      'outros': 'Outros'
    };
    return categoriaMap[valueStr] || valueStr;
  }
  
  return valueStr;
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
    const { ticketId, type, textoResposta, testPhone, payload } = await req.json()

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

    // For other notification types, fetch ticket data (only if ticketId is provided)
    let ticket: any = null;
    
    if (ticketId && ticketId !== 'null') {
      console.log('Fetching ticket data for ID:', ticketId);
      try {
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            unidades (id, grupo, id_grupo_azul, id_grupo_branco, id_grupo_vermelho, telefone),
            colaboradores (nome_completo)
          `)
          .eq('id', ticketId)
          .single();

        if (ticketError) {
          console.error('Ticket fetch error:', ticketError);
          throw new Error(`Error fetching ticket: ${ticketError.message}`);
        }

        if (!ticketData) {
          console.error('No ticket data found for ID:', ticketId);
          throw new Error('Ticket não encontrado');
        }
        
        ticket = ticketData;
        console.log('Ticket data loaded successfully:', ticket.codigo_ticket);
      } catch (fetchError) {
        console.error('Error in ticket fetch:', fetchError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Erro ao buscar ticket: ${fetchError.message}`,
            error: fetchError.message 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
      }
    }
    
    // Only log ticket details if ticket exists
    if (ticket) {
      console.log('Ticket found:', {
        id: ticket.id,
        codigo: ticket.codigo_ticket,
        franqueado_id: ticket.franqueado_id
      });
    } else {
      console.log('No ticket data needed for this notification type');
    }

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

    // Função para normalizar número de telefone (pula grupos)
    const normalizePhoneNumber = (phone: any): string | null => {
      if (!phone) return null
      
      const phoneStr = phone.toString()
      
      // Se é um ID de grupo (contém '-group'), retorna como está
      if (phoneStr.includes('-group') || phoneStr.includes('@g.us')) {
        console.log('Group ID detected, skipping normalization:', phoneStr)
        return phoneStr
      }
      
      // Normaliza apenas números individuais
      let cleanPhone = phoneStr.replace(/\D/g, '') // Remove tudo que não é dígito
      
      // Se tem 13 dígitos e começa com 55, já tem código do país
      if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
        return cleanPhone
      }
      
      // Se tem 11 dígitos, adiciona código do país (55)
      if (cleanPhone.length === 11) {
        return '55' + cleanPhone
      }
      
      // Se tem 10 dígitos, adiciona 9 e código do país
      if (cleanPhone.length === 10) {
        return '55' + cleanPhone.charAt(0) + cleanPhone.charAt(1) + '9' + cleanPhone.substring(2)
      }
      
      console.warn('Phone number format not recognized:', phone)
      return cleanPhone.length >= 10 ? cleanPhone : null
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

    // Get destination number based on new source configuration system
    const customDestination = await getDestinationNumber(supabase, type, ticket);

    switch (type) {
      case 'ticket_created':
      case 'ticket_criado':
        console.log('Processing ticket_created/ticket_criado');
        
        if (!ticket) {
          throw new Error('Ticket data is required for ticket_created notifications');
        }
        
        if (customDestination) {
          destinoFinal = customDestination;
          console.log(`Using configured destination for ticket_created: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma configuração de origem encontrada para ticket_created na unidade ${ticket.unidade_id}`);
        }

        const templateTicket = await getMessageTemplate(supabase, 'ticket_created');
        // Get additional ticket information for richer variables
        const { data: unidadeData } = await supabase
          .from('unidades')
          .select('nome')
          .eq('id', ticket.unidade_id)
          .single();

        const { data: equipeData } = await supabase
          .from('equipes')
          .select('nome')
          .eq('id', ticket.equipe_responsavel_id)
          .single();

        const { data: colaboradorData } = await supabase
          .from('colaboradores')
          .select('nome_completo')
          .eq('id', ticket.colaborador_id)
          .single();

        const mensagemTicket = processTemplate(templateTicket, {
          codigo_ticket: formatTicketTitle(ticket),
          titulo_ticket: ticket.titulo || 'Ticket sem título',
          unidade_id: ticket.unidade_id,
          unidade_nome: unidadeData?.nome || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          descricao_problema: ticket.descricao_problema,
          data_abertura: new Date(ticket.data_abertura).toLocaleString('pt-BR'),
          equipe_responsavel: equipeData?.nome || 'Não atribuída',
          colaborador_responsavel: colaboradorData?.nome_completo || 'Não atribuído',
          status: ticket.status,
          data_limite_sla: ticket.data_limite_sla ? new Date(ticket.data_limite_sla).toLocaleString('pt-BR') : 'Não definido'
        });

        const normalizedPhoneTicket = normalizePhoneNumber(destinoFinal);
        if (!normalizedPhoneTicket) {
          throw new Error(`Número de telefone inválido para ticket_created: ${destinoFinal}`);
        }
        resultadoEnvio = await sendZapiMessage(normalizedPhoneTicket, mensagemTicket);
        break;

      case 'resposta_ticket':
        console.log('Processing resposta_ticket');
        
        if (!ticket) {
          throw new Error('Ticket data is required for resposta_ticket notifications');
        }
        
        if (customDestination) {
          destinoFinal = customDestination;
          console.log(`Using configured destination for resposta_ticket: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma configuração de origem encontrada para resposta_ticket na unidade ${ticket.unidade_id}`);
        }

        const templateResposta = await getMessageTemplate(supabase, 'resposta_ticket');
        
        // Get additional ticket information for richer variables
        const { data: unidadeDataResp } = await supabase
          .from('unidades')
          .select('nome')
          .eq('id', ticket.unidade_id)
          .single();

        const { data: equipeDataResp } = await supabase
          .from('equipes')
          .select('nome')
          .eq('id', ticket.equipe_responsavel_id)
          .single();

        const mensagemResposta = processTemplate(templateResposta, {
          codigo_ticket: formatTicketTitle(ticket),
          titulo_ticket: ticket.titulo || 'Ticket sem título',
          unidade_id: ticket.unidade_id,
          unidade_nome: unidadeDataResp?.nome || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          status: ticket.status,
          equipe_responsavel: equipeDataResp?.nome || 'Não atribuída',
          texto_resposta: textoResposta,
          timestamp: new Date().toLocaleString('pt-BR')
        });

        const normalizedPhoneResp = normalizePhoneNumber(destinoFinal);
        if (!normalizedPhoneResp) {
          throw new Error(`Número de telefone inválido para resposta_ticket: ${destinoFinal}`);
        }
        resultadoEnvio = await sendZapiMessage(normalizedPhoneResp, mensagemResposta);
        break;

      case 'resposta_ticket_franqueado':
      case 'resposta_ticket_privado':
        console.log(`Processing ${type} - sending to franqueado (solicitante) phone`);
        
        if (!ticket) {
          throw new Error(`Ticket data is required for ${type} notifications`);
        }
        
        // For franqueado responses, we always send to the original requester
        // regardless of source configuration
        const franqueadoSolicitante = await getFranqueadoSolicitante(ticket);
        if (!franqueadoSolicitante || !franqueadoSolicitante.phone) {
          throw new Error('Telefone do franqueado (solicitante) não configurado');
        }

        console.log(`Sending message to franqueado (solicitante) phone: ${franqueadoSolicitante.phone}`);

        const templateFranqueado = await getMessageTemplate(supabase, 'resposta_ticket_franqueado');
        
        // Get additional ticket information for richer variables
        const { data: unidadeDataFranqueado } = await supabase
          .from('unidades')
          .select('nome')
          .eq('id', ticket.unidade_id)
          .single();

        const { data: equipeDataFranqueado } = await supabase
          .from('equipes')
          .select('nome')
          .eq('id', ticket.equipe_responsavel_id)
          .single();

        const mensagemFranqueado = processTemplate(templateFranqueado, {
          codigo_ticket: formatTicketTitle(ticket),
          titulo_ticket: ticket.titulo || 'Ticket sem título',
          unidade_id: ticket.unidade_id,
          unidade_nome: unidadeDataFranqueado?.nome || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          status: ticket.status,
          equipe_responsavel: equipeDataFranqueado?.nome || 'Não atribuída',
          descricao_problema: ticket.descricao_problema,
          data_abertura: new Date(ticket.data_abertura).toLocaleString('pt-BR'),
          data_limite_sla: ticket.data_limite_sla ? new Date(ticket.data_limite_sla).toLocaleString('pt-BR') : 'Não definido',
          texto_resposta: textoResposta,
          timestamp: new Date().toLocaleString('pt-BR')
        });

        resultadoEnvio = await sendZapiMessage(franqueadoSolicitante.phone, mensagemFranqueado);
        destinoFinal = franqueadoSolicitante.phone;
        break;

      case 'sla_half':
        console.log('Processing sla_half');
        
        if (!ticket) {
          throw new Error('Ticket data is required for sla_half notifications');
        }
        
        if (customDestination) {
          destinoFinal = customDestination;
          console.log(`Using configured destination for sla_half: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma configuração de origem encontrada para sla_half na unidade ${ticket.unidade_id}`);
        }

        const templateSLAHalf = await getMessageTemplate(supabase, 'sla_half');
        
        // Get additional ticket information for richer variables
        const { data: unidadeDataSLAHalf } = await supabase
          .from('unidades')
          .select('nome')
          .eq('id', ticket.unidade_id)
          .single();

        const { data: equipeDataSLAHalf } = await supabase
          .from('equipes')
          .select('nome')
          .eq('id', ticket.equipe_responsavel_id)
          .single();

        const mensagemSLAHalf = processTemplate(templateSLAHalf, {
          codigo_ticket: formatTicketTitle(ticket),
          titulo_ticket: ticket.titulo || 'Ticket sem título',
          unidade_id: ticket.unidade_id,
          unidade_nome: unidadeDataSLAHalf?.nome || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          status: ticket.status,
          equipe_responsavel: equipeDataSLAHalf?.nome || 'Não atribuída',
          descricao_problema: ticket.descricao_problema,
          data_abertura: new Date(ticket.data_abertura).toLocaleString('pt-BR'),
          data_limite_sla: new Date(ticket.data_limite_sla).toLocaleString('pt-BR')
        });

        const normalizedPhoneSLAHalf = normalizePhoneNumber(destinoFinal);
        if (!normalizedPhoneSLAHalf) {
          throw new Error(`Número de telefone inválido para sla_half: ${destinoFinal}`);
        }
        resultadoEnvio = await sendZapiMessage(normalizedPhoneSLAHalf, mensagemSLAHalf);
        break;

      case 'sla_breach':
        console.log('Processing sla_breach');
        
        if (!ticket) {
          throw new Error('Ticket data is required for sla_breach notifications');
        }
        
        // First, escalate the ticket automatically if not already concluded
        if (ticket.status !== 'concluido') {
          console.log(`Auto-escalating ticket ${ticket.codigo_ticket} due to SLA breach`);
          
          const { error: escalationError } = await supabase
            .from('tickets')
            .update({ 
              status: 'escalonado',
              escalonamento_nivel: (ticket.escalonamento_nivel || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', ticket.id);

          if (escalationError) {
            console.error('Error escalating ticket:', escalationError);
          } else {
            console.log(`Ticket ${ticket.codigo_ticket} successfully escalated`);
            
            // Log the escalation action
            await supabase
              .from('escalation_logs')
              .insert({
                ticket_id: ticket.id,
                event_type: 'auto_escalation',
                message: `Ticket automatically escalated due to SLA breach at ${new Date().toISOString()}`,
                to_level: (ticket.escalonamento_nivel || 0) + 1,
                canal: 'system'
              });
          }
        }
        
        if (customDestination) {
          destinoFinal = customDestination;
          console.log(`Using configured destination for sla_breach: ${destinoFinal}`);
        } else {
          throw new Error(`Nenhuma configuração de origem encontrada para sla_breach na unidade ${ticket.unidade_id}`);
        }

        const templateSLABreach = await getMessageTemplate(supabase, 'sla_breach');
        
        // Get additional ticket information for richer variables
        const { data: unidadeDataSLABreach } = await supabase
          .from('unidades')
          .select('nome')
          .eq('id', ticket.unidade_id)
          .single();

        const { data: equipeDataSLABreach } = await supabase
          .from('equipes')
          .select('nome')
          .eq('id', ticket.equipe_responsavel_id)
          .single();

        const mensagemSLABreach = processTemplate(templateSLABreach, {
          codigo_ticket: formatTicketTitle(ticket),
          titulo_ticket: ticket.titulo || 'Ticket sem título',
          unidade_id: ticket.unidade_id,
          unidade_nome: unidadeDataSLABreach?.nome || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          status: ticket.status,
          equipe_responsavel: equipeDataSLABreach?.nome || 'Não atribuída',
          descricao_problema: ticket.descricao_problema,
          data_abertura: new Date(ticket.data_abertura).toLocaleString('pt-BR'),
          data_limite_sla: new Date(ticket.data_limite_sla).toLocaleString('pt-BR')
        });

        const normalizedPhone = normalizePhoneNumber(destinoFinal);
        if (!normalizedPhone) {
          throw new Error(`Número de telefone inválido: ${destinoFinal}`);
        }
        resultadoEnvio = await sendZapiMessage(normalizedPhone, mensagemSLABreach);
        break;

      case 'crisis_broadcast':
        console.log('Processing crisis_broadcast');
        
        // Para crisis_broadcast, o phone e message já vêm no payload
        const phone = payload.phone;
        const message = payload.message;
        
        if (!phone || !message) {
          throw new Error('Phone and message are required for crisis_broadcast');
        }
        
        const normalizedPhoneCrisis = normalizePhoneNumber(phone);
        if (!normalizedPhoneCrisis) {
          throw new Error(`Número de telefone inválido para crisis_broadcast: ${phone}`);
        }
        resultadoEnvio = await sendZapiMessage(normalizedPhoneCrisis, message);
        destinoFinal = phone;
        break;

      default:
        throw new Error(`Tipo de notificação não implementado: ${type}`);
    }

    // Log the result
    console.log(`Notification sent to: ${destinoFinal.replace(/(\d{4})\d+(\d{4})/, '$1***$2')}`);
    console.log('Send result:', { success: resultadoEnvio?.success || false, status: resultadoEnvio?.status || 'undefined' });

    // Registrar log do envio (only if ticketId exists)
    if (ticketId && ticketId !== 'null') {
      try {
        await supabase
          .from('escalation_logs')
          .insert({
            ticket_id: ticketId,
            event_type: type,
            message: `WhatsApp notification sent to ${destinoFinal}`,
            response: resultadoEnvio,
            canal: 'zapi'
          });
      } catch (logError) {
        console.error('Error logging escalation:', logError);
        // Don't fail the whole operation if logging fails
      }
    }

    return new Response(
      JSON.stringify({
        success: resultadoEnvio?.success || false,
        message: resultadoEnvio?.success 
          ? `Mensagem enviada com sucesso para ${destinoFinal.replace(/(\d{4})\d+(\d{4})/, '$1***$2')}` 
          : resultadoEnvio?.error || 'Erro ao enviar mensagem',
        data: resultadoEnvio?.data || null,
        destination: destinoFinal.replace(/(\d{4})\d+(\d{4})/, '$1***$2')
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: resultadoEnvio?.success ? 200 : 400
      }
    );

  } catch (error) {
    console.error('Error in process-notifications:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause
    });
    
    // Additional debugging info
    console.error('Request type:', type);
    console.error('Ticket ID:', ticketId);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        message: `Erro no processamento: ${error.message}`,
        details: error.stack,
        type: error.name
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
