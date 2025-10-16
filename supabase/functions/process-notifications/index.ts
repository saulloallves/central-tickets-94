// @ts-nocheck
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
    console.log(`\n🎯 ===== GETTING DESTINATION NUMBER =====`);
    console.log(`🎯 Notification type: ${type}`);
    console.log(`🎯 Ticket.unidade_id: ${ticket?.unidade_id}`);
    console.log(`🎯 Ticket.unidades:`, ticket?.unidades ? JSON.stringify(ticket.unidades) : 'não disponível');
    console.log(`🎯 Full ticket data:`, JSON.stringify(ticket, null, 2));

    // Get source configuration for this notification type
    const { data: sourceConfig, error: configError } = await supabase
      .from('notification_source_config')
      .select('*')
      .eq('notification_type', type)
      .eq('is_active', true)
      .maybeSingle();

    if (configError) {
      console.error('❌ Error fetching source config:', configError);
      return null;
    }

    if (!sourceConfig) {
      console.log(`⚠️ No source configuration found for ${type}, using legacy fallback`);
      const legacyDest = getLegacyDestination(type, ticket);
      console.log(`📞 Legacy destination found: ${legacyDest}`);
      return legacyDest;
    }

    console.log(`✅ Using source config for ${type}:`, sourceConfig);

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
            sourceConfig.filter_column,
            sourceConfig.filter_value_source,
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

async function getNumberFromColumn(
  supabase: any, 
  table: string, 
  column: string,
  filterColumn?: string,
  filterValueSource?: string,
  ticket?: any
): Promise<string | null> {
  console.log(`\n📋 ===== getNumberFromColumn =====`);
  console.log(`📋 Table: ${table}, Column: ${column}`);
  console.log(`📋 Filter: ${filterColumn} from ${filterValueSource}`);
  console.log(`📋 Ticket data keys:`, ticket ? Object.keys(ticket) : 'no ticket');
  console.log(`📋 Ticket.unidades keys:`, ticket?.unidades ? Object.keys(ticket.unidades) : 'no unidades');
  
  try {
    // Se tem filtro configurado, buscar com filtro
    if (filterColumn && filterValueSource && ticket) {
      console.log(`🔍 Buscando com filtro: ${filterColumn} = valor de ${filterValueSource}`);
      
      // Extrair valor do filtro (ex: unidades.codigo_grupo)
      const [sourceTable, sourceColumn] = filterValueSource.split('.');
      let filterValue = null;
      
      console.log(`🔍 Extraindo: ${sourceTable}.${sourceColumn}`);
      console.log(`🔍 ticket.unidades disponível?`, !!ticket?.unidades);
      console.log(`🔍 ticket.unidades.${sourceColumn}:`, ticket?.unidades?.[sourceColumn]);
      
      if (sourceTable === 'unidades' && ticket?.unidades) {
        filterValue = ticket.unidades[sourceColumn];
        console.log(`✅ Valor extraído de ticket.unidades.${sourceColumn}: ${filterValue}`);
      } else if (sourceTable === 'tickets' && ticket) {
        filterValue = ticket[sourceColumn];
        console.log(`✅ Valor extraído de ticket.${sourceColumn}: ${filterValue}`);
      }
      
      if (filterValue) {
        console.log(`✅ Aplicando filtro: ${table}.${filterColumn} = ${filterValue}`);
        const { data, error } = await supabase
          .from(table)
          .select(column)
          .eq(filterColumn, filterValue)
          .maybeSingle();
          
        if (error) {
          console.error(`❌ Erro ao buscar com filtro:`, error);
          return null;
        }
        
        if (data && data[column]) {
          console.log(`✅ ✅ ✅ Número encontrado: ${data[column]} de ${table}.${column}`);
          return data[column];
        } else {
          console.warn(`⚠️ Nenhum registro encontrado em ${table} com ${filterColumn}=${filterValue}`);
        }
      } else {
        console.error(`❌ Valor do filtro NÃO encontrado para ${filterValueSource}`);
        console.error(`❌ Dados disponíveis no ticket:`, JSON.stringify(ticket, null, 2));
      }
    } else {
      console.log(`ℹ️ Sem filtro configurado, tentando buscar primeiro registro`);
    }
    
    // Fallback: buscar sem filtro (lógica antiga)
    switch (table) {
      case 'unidades':
        if (ticket?.unidade_id) {
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
  console.log(`🔙 Using legacy destination for type: ${type}`);
  console.log(`📞 Available id_grupo_branco: ${ticket.unidades?.id_grupo_branco}`);
  
  switch (type) {
    case 'resposta_ticket':
    case 'ticket_created':
    case 'sla_half':
      // ⚠️ sla_breach REMOVIDO do fallback - deve usar apenas configuração explícita
      const destination = ticket.unidades?.id_grupo_branco || null;
      console.log(`📱 Legacy destination result: ${destination}`);
      return destination;
    
    case 'sla_breach':
      // ❌ SLA breach não usa fallback para grupo branco
      console.log(`❌ SLA breach não permite fallback - configuração obrigatória`);
      return null;
    
    default:
      console.log(`❌ No legacy destination configured for type: ${type}`);
      return null;
  }
}

// Get Z-API configuration from database or fallback to secrets
async function getZApiConfig(supabase: any): Promise<ZApiConfig | null> {
  try {
    // First, try to get the notification-specific configuration
    const { data: notificationData, error: notificationError } = await supabase
      .from('messaging_providers')
      .select('instance_id, instance_token, client_token, base_url')
      .eq('provider_name', 'send_ticket_notification')
      .eq('is_active', true)
      .single();

    if (!notificationError && notificationData) {
      console.log('✅ Using notification-specific Z-API configuration from database');
      return {
        instanceId: notificationData.instance_id,
        instanceToken: notificationData.instance_token,
        clientToken: notificationData.client_token,
        baseUrl: notificationData.base_url
      };
    }

    // Fallback to the legacy 'zapi' configuration
    console.log('⚠️ Notification config not found, falling back to legacy zapi config');
    const { data, error } = await supabase
      .from('messaging_providers')
      .select('instance_id, instance_token, client_token, base_url')
      .eq('provider_name', 'zapi')
      .eq('is_active', true)
      .single();

    if (!error && data) {
      console.log('📡 Using legacy Z-API configuration from database');
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
    'ticket_created': `🎫 *NOVO TICKET*

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

🕐 *Respondido em:* {{timestamp}}`,

    'ticket_forwarded': `🔄 *TICKET ENCAMINHADO PARA SUA EQUIPE*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

💬 *Problema:*
{{descricao_problema}}

🕐 *Encaminhado em:* {{timestamp}}
⏰ *Prazo SLA:* {{data_limite_sla}}

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
⏰ *Tempo restante:* {{tempo_restante_sla}}

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
⏰ *Status SLA:* {{tempo_restante_sla}}

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
  
  // Debug log para verificar variáveis
  console.log('🔧 Processando template com variáveis:', Object.keys(variables));
  if (variables.timestamp) {
    console.log('🕐 Timestamp original:', variables.timestamp, 'Tipo:', typeof variables.timestamp);
  }
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const formattedValue = formatDisplayValue(key, value);
    
    // Log específico para timestamp
    if (key === 'timestamp') {
      console.log(`🔄 Substituindo ${placeholder} por: "${formattedValue}"`);
    }
    
    processed = processed.replace(new RegExp(placeholder, 'g'), String(formattedValue || ''));
  }
  
  // Verificar se ainda restam placeholders não substituídos
  const remainingPlaceholders = processed.match(/\{\{[^}]+\}\}/g);
  if (remainingPlaceholders) {
    console.warn('⚠️ Placeholders não substituídos:', remainingPlaceholders);
  }
  
  return processed;
}

// Format values for better display in messages
function formatDisplayValue(key: string, value: any): string {
  if (!value) return '';
  
  const valueStr = String(value);
  
  // Format timestamp values
  if (key === 'timestamp') {
    try {
      // Se for um objeto Date, formatar diretamente
      if (value instanceof Date) {
        return value.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });
      }
      // Se for uma string que parece timestamp, tentar converter
      if (typeof value === 'string' && value.includes('/')) {
        return value; // Já está formatado
      }
      // Tentar criar date from string/number
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });
      }
    } catch (error) {
      console.error('Erro ao formatar timestamp:', error);
    }
    // Fallback para valor original se não conseguir formatar
    return valueStr;
  }
  
  // Format priority values
  if (key === 'prioridade') {
    const prioridadeMap: Record<string, string> = {
      'baixo': 'Baixo',
      'medio': 'Médio', 
      'alto': 'Alto',
      'imediato': 'Imediato',
      'crise': 'Crise',
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
    const notificationId = payload?.notificationId;

    console.log(`🔔 [${type}] ====== INÍCIO DO PROCESSAMENTO ======`);
    console.log(`🎫 Ticket ID: ${ticketId}`);
    console.log(`📋 Notification Type: ${type}`);
    console.log(`🔑 Notification ID: ${notificationId}`);
    console.log(`📦 Payload recebido:`, JSON.stringify(payload, null, 2));

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
          const phoneStr = phone.toString();
          
          // If it's already a group ID (contains '-group'), return as is
          if (phoneStr.includes('-group')) {
            console.log(`📱 Group ID detected: ${phoneStr}`);
            return phoneStr;
          }
          
          // Otherwise, normalize as phone number
          let cleanPhone = phoneStr.replace(/\D/g, '');
          if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) return cleanPhone;
          if (cleanPhone.length === 11) return '55' + cleanPhone;
          if (cleanPhone.length === 10) return '55' + cleanPhone.charAt(0) + cleanPhone.charAt(1) + '9' + cleanPhone.substring(2);
          return cleanPhone.length >= 10 ? cleanPhone : null;
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

    // For ticket-based notifications, fetch ticket data (only if ticketId is provided)
    let ticket: any = null;
    
    // Types that require ticket data
    const ticketRequiredTypes = ['ticket_created', 'ticket_criado', 'sla_half', 'sla_breach', 'resposta_ticket', 'ticket_forwarded'];
    
    if (ticketId && ticketId !== 'null' && ticketRequiredTypes.includes(type)) {
      console.log('Fetching ticket data for ID:', ticketId);
      try {
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            unidades (id, grupo, codigo_grupo, id_grupo_azul, id_grupo_branco, id_grupo_vermelho, telefone),
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
      console.log('\n🎫 ===== TICKET DATA LOADED =====');
      console.log('🎫 ID:', ticket.id);
      console.log('🎫 Código:', ticket.codigo_ticket);
      console.log('🎫 Franqueado ID:', ticket.franqueado_id);
      console.log('🎫 Unidade ID:', ticket.unidade_id);
      console.log('🎫 Unidades data:', JSON.stringify(ticket.unidades, null, 2));
      console.log('🎫 ===== END TICKET DATA =====\n');
    } else {
      console.log(`⚠️ No ticket data fetched for type ${type} - either no ticketId provided or type doesn't require ticket data`);
    }

    // Validate that we have ticket data when required
    if (ticketRequiredTypes.includes(type) && !ticket) {
      const errorMsg = `Ticket data is required for ${type} notifications but not found. TicketId: ${ticketId}`;
      console.error('❌', errorMsg);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: errorMsg,
          error: 'TICKET_DATA_REQUIRED' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
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

    // Função para retornar apenas o código do ticket
    const formatTicketTitle = (ticket: any) => {
      return ticket.codigo_ticket || 'Sem código'
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
    console.log('🎯 About to call getDestinationNumber with:', { type, ticketExists: !!ticket, ticketId: ticket?.id });
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
          .select('grupo')
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
          unidade_nome: unidadeData?.grupo || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          descricao_problema: ticket.descricao_problema,
          data_abertura: new Date(ticket.data_abertura).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          equipe_responsavel: equipeData?.nome || 'Não atribuída',
          colaborador_responsavel: colaboradorData?.nome_completo || 'Não atribuído',
          status: ticket.status,
          data_limite_sla: ticket.data_limite_sla ? new Date(ticket.data_limite_sla).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não definido'
        });

        const normalizedPhoneTicket = normalizePhoneNumber(destinoFinal);
        if (!normalizedPhoneTicket) {
          throw new Error(`Número de telefone inválido para ticket_created: ${destinoFinal}`);
        }
        resultadoEnvio = await sendZapiMessage(normalizedPhoneTicket, mensagemTicket);
        break;

      case 'resposta_ticket':
        console.log('📤 Calling send-ticket-notification for resposta_ticket as plain text');
        
        if (!ticket) {
          throw new Error('Ticket data is required for resposta_ticket notifications');
        }
        
        // Call send-ticket-notification as plain text (no buttons)
        try {
          const functionsBaseUrl = `https://${Deno.env.get('SUPABASE_URL')?.split('//')[1]}/functions/v1` || 'https://hryurntaljdisohawpqf.supabase.co/functions/v1';
          const notificationResponse = await fetch(`${functionsBaseUrl}/send-ticket-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              ticket_id: ticketId,
              template_key: 'resposta_ticket',
              resposta_real: textoResposta
            })
          });

          if (notificationResponse.ok) {
            const notificationResult = await notificationResponse.json();
            console.log('✅ Notification with buttons sent successfully');
            resultadoEnvio = { success: true, status: 'notification_sent_with_buttons' };
          } else {
            console.log('⚠️ Button notification failed, trying fallback...');
            throw new Error('Failed to send with buttons, using fallback');
          }
        } catch (error) {
          console.error('Error calling send-ticket-notification:', error);
          console.log('📝 Using fallback text message without buttons');
          
          // Fallback to simple text message
          if (customDestination) {
            destinoFinal = customDestination;
            console.log(`Using configured destination for resposta_ticket fallback: ${destinoFinal}`);
          } else {
            throw new Error(`Nenhuma configuração de origem encontrada para resposta_ticket na unidade ${ticket.unidade_id}`);
          }

          const templateResposta = await getMessageTemplate(supabase, 'resposta_ticket');
          
          // Get additional ticket information for richer variables
          const { data: unidadeDataResp } = await supabase
            .from('unidades')
            .select('grupo')
            .eq('id', ticket.unidade_id)
            .single();

          const { data: equipeDataResp } = await supabase
            .from('equipes')
            .select('nome')
            .eq('id', ticket.equipe_responsavel_id)
            .single();

          const textoResposta = payload?.texto_resposta || payload?.message || 'Resposta disponível no sistema';

          const mensagemResposta = processTemplate(templateResposta, {
            codigo_ticket: formatTicketTitle(ticket),
            titulo_ticket: ticket.titulo || 'Ticket sem título',
            unidade_id: ticket.unidade_id,
            unidade_nome: unidadeDataResp?.grupo || ticket.unidade_id,
            categoria: ticket.categoria || 'Não informada',
            prioridade: ticket.prioridade,
            status: ticket.status,
            equipe_responsavel: equipeDataResp?.nome || 'Não atribuída',
            texto_resposta: textoResposta,
            timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
          });

          const normalizedPhoneResp = normalizePhoneNumber(destinoFinal);
          if (!normalizedPhoneResp) {
            throw new Error(`Número de telefone inválido para resposta_ticket: ${destinoFinal}`);
          }
          resultadoEnvio = await sendZapiMessage(normalizedPhoneResp, mensagemResposta);
        }
        break;

      case 'resposta_ticket_franqueado':
      case 'resposta_ticket_privado':
        console.log(`Processing ${notificationType} - sending to franqueado (solicitante) phone`);
        
        if (!ticket) {
          throw new Error(`Ticket data is required for ${notificationType} notifications`);
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
          .select('grupo')
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
          unidade_nome: unidadeDataFranqueado?.grupo || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          status: ticket.status,
          equipe_responsavel: equipeDataFranqueado?.nome || 'Não atribuída',
          descricao_problema: ticket.descricao_problema,
          data_abertura: new Date(ticket.data_abertura).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          data_limite_sla: ticket.data_limite_sla ? new Date(ticket.data_limite_sla).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não definido',
          texto_resposta: textoResposta,
          timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
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
          .select('grupo')
          .eq('id', ticket.unidade_id)
          .single();

        const { data: equipeDataSLAHalf } = await supabase
          .from('equipes')
          .select('nome')
          .eq('id', ticket.equipe_responsavel_id)
          .single();

        // Calcular tempo restante formatado
        const minutosRestantes = ticket.sla_minutos_restantes || 0;
        const horas = Math.floor(minutosRestantes / 60);
        const minutos = minutosRestantes % 60;
        const tempoRestanteSLA = minutosRestantes > 0 
          ? `${horas}h ${minutos}min` 
          : 'SLA vencido';

        const mensagemSLAHalf = processTemplate(templateSLAHalf, {
          codigo_ticket: formatTicketTitle(ticket),
          titulo_ticket: ticket.titulo || 'Ticket sem título',
          unidade_id: ticket.unidade_id,
          unidade_nome: unidadeDataSLAHalf?.grupo || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          status: ticket.status,
          equipe_responsavel: equipeDataSLAHalf?.nome || 'Não atribuída',
          descricao_problema: ticket.descricao_problema,
          tempo_restante_sla: tempoRestanteSLA,
          data_abertura: new Date(ticket.data_abertura).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          data_limite_sla: new Date(ticket.data_limite_sla).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        });

        const normalizedPhoneSLAHalf = normalizePhoneNumber(destinoFinal);
        if (!normalizedPhoneSLAHalf) {
          throw new Error(`Número de telefone inválido para sla_half: ${destinoFinal}`);
        }
        resultadoEnvio = await sendZapiMessage(normalizedPhoneSLAHalf, mensagemSLAHalf);
        
        // ✅ Mark notification as sent to WhatsApp to prevent duplicates
        if (resultadoEnvio.success && notificationId) {
          console.log(`📝 Marcando notificação SLA Half ${notificationId} como enviada...`);
          
          const { error: updateError } = await supabase
            .from('notifications_queue')
            .update({ 
              status: 'processed',
              sent_to_whatsapp: true,
              processed_at: new Date().toISOString()
            })
            .eq('id', notificationId);
          
          if (updateError) {
            console.error(`❌ Erro ao marcar notificação SLA Half como enviada:`, updateError);
          } else {
            console.log(`✅ Notificação SLA Half marcada como enviada ao WhatsApp`);
          }
        }
        break;

      case 'ticket_forwarded':
        console.log('🔄 Processing ticket_forwarded notification');
        
        if (!ticket) {
          throw new Error('Ticket data is required for ticket_forwarded notifications');
        }
        
        // Get the new team information
        const equipeId = payload?.equipe_id || ticket.equipe_responsavel_id;
        if (!equipeId) {
          throw new Error('Equipe ID não encontrada para notificação de encaminhamento');
        }
        
        console.log(`📤 Sending notification to team: ${equipeId}`);
        
        // Get team members who should be notified
        const { data: teamMembers, error: membersError } = await supabase
          .from('equipe_members')
          .select(`
            user_id,
            profiles:user_id (
              id,
              telefone,
              nome_completo
            )
          `)
          .eq('equipe_id', equipeId)
          .eq('ativo', true);
        
        if (membersError) {
          console.error('Error fetching team members:', membersError);
          throw new Error('Erro ao buscar membros da equipe');
        }
        
        if (!teamMembers || teamMembers.length === 0) {
          console.warn(`⚠️ No active team members found for equipe ${equipeId}`);
          resultadoEnvio = { success: false, message: 'No team members to notify' };
          break;
        }
        
        console.log(`📋 Found ${teamMembers.length} team members to notify`);
        
        // Get template and prepare message
        const templateForwarded = await getMessageTemplate(supabase, 'ticket_forwarded');
        
        const { data: unidadeDataForwarded } = await supabase
          .from('unidades')
          .select('grupo')
          .eq('id', ticket.unidade_id)
          .single();
        
        const { data: equipeDataForwarded } = await supabase
          .from('equipes')
          .select('nome')
          .eq('id', equipeId)
          .single();
        
        const mensagemForwarded = processTemplate(templateForwarded, {
          codigo_ticket: formatTicketTitle(ticket),
          titulo_ticket: ticket.titulo || 'Ticket sem título',
          unidade_id: ticket.unidade_id,
          unidade_nome: unidadeDataForwarded?.grupo || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          status: ticket.status,
          equipe_responsavel: equipeDataForwarded?.nome || 'Não atribuída',
          descricao_problema: ticket.descricao_problema,
          timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          data_limite_sla: ticket.data_limite_sla ? new Date(ticket.data_limite_sla).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não definido'
        });
        
        // Send to all team members
        const sendResults = [];
        for (const member of teamMembers) {
          const profile = member.profiles as any;
          if (profile?.telefone) {
            console.log(`📞 Sending to team member: ${profile.nome_completo} (${profile.telefone})`);
            const normalizedMemberPhone = normalizePhoneNumber(profile.telefone);
            if (normalizedMemberPhone) {
              try {
                const sendResult = await sendZapiMessage(normalizedMemberPhone, mensagemForwarded);
                sendResults.push({ 
                  member: profile.nome_completo, 
                  phone: normalizedMemberPhone,
                  success: sendResult.success 
                });
              } catch (error) {
                console.error(`Error sending to ${profile.nome_completo}:`, error);
                sendResults.push({ 
                  member: profile.nome_completo, 
                  phone: normalizedMemberPhone,
                  success: false,
                  error: error.message 
                });
              }
            }
          }
        }
        
        resultadoEnvio = { 
          success: sendResults.some(r => r.success),
          message: `Sent to ${sendResults.filter(r => r.success).length} of ${sendResults.length} team members`,
          details: sendResults
        };
        destinoFinal = `Team ${equipeDataForwarded?.nome || equipeId} (${sendResults.length} members)`;
        break;

      case 'sla_breach':
        console.log('\n🚨 ===== PROCESSANDO SLA BREACH =====');
        console.log('🎫 Ticket ID:', ticket?.id);
        console.log('📋 Código Ticket:', ticket?.codigo_ticket);
        console.log('🏢 Unidade ID:', ticket?.unidade_id);
        console.log('📊 Status atual:', ticket?.status);
        console.log('🔍 Tem dados de unidades?', !!ticket?.unidades);
        console.log('📞 id_grupo_branco:', ticket?.unidades?.id_grupo_branco);
        console.log('📞 id_grupo_azul:', ticket?.unidades?.id_grupo_azul);
        console.log('📞 id_grupo_vermelho:', ticket?.unidades?.id_grupo_vermelho);
        console.log('📞 Todos os dados da unidade:', JSON.stringify(ticket?.unidades, null, 2));
        
        if (!ticket) {
          const errorMsg = 'Ticket data is required for sla_breach notifications';
          console.error('❌ ERRO CRÍTICO:', errorMsg);
          throw new Error(errorMsg);
        }
        
        // First, escalate the ticket automatically if not already concluded
        if (ticket.status !== 'concluido') {
          console.log(`🔼 Auto-escalating ticket ${ticket.codigo_ticket} due to SLA breach`);
          
          const { error: escalationError } = await supabase
            .from('tickets')
            .update({ 
              status: 'escalonado',
              escalonamento_nivel: (ticket.escalonamento_nivel || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', ticket.id);

          if (escalationError) {
            console.error('❌ Error escalating ticket:', escalationError);
          } else {
            console.log(`✅ Ticket ${ticket.codigo_ticket} successfully escalated`);
            
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
        
        console.log(`\n🎯 ===== DETECTANDO DESTINO PARA SLA BREACH =====`);
        console.log(`📞 Custom destination recebido: ${customDestination}`);
        
        if (!customDestination) {
          console.error(`\n❌ ===== ERRO: NENHUM DESTINO ENCONTRADO =====`);
          console.error(`❌ Unidade ID: ${ticket.unidade_id}`);
          console.error(`❌ Dados disponíveis da unidade:`, JSON.stringify(ticket.unidades, null, 2));
          console.error(`❌ Verificar se existe configuração em notification_source_config para 'sla_breach'`);
          console.error(`❌ Verificar se unidade tem id_grupo_branco configurado`);
          throw new Error(`CRÍTICO: Nenhuma configuração de destino encontrada para sla_breach na unidade ${ticket.unidade_id}`);
        }
        
        destinoFinal = customDestination;
        console.log(`✅ ===== DESTINO CONFIRMADO PARA SLA BREACH =====`);
        console.log(`📱 Destino final: ${destinoFinal}`);
        console.log(`📋 Será enviado para: ${destinoFinal}`);

        const templateSLABreach = await getMessageTemplate(supabase, 'sla_breach');
        
        // Get additional ticket information for richer variables
        const { data: unidadeDataSLABreach } = await supabase
          .from('unidades')
          .select('grupo')
          .eq('id', ticket.unidade_id)
          .single();

        const { data: equipeDataSLABreach } = await supabase
          .from('equipes')
          .select('nome')
          .eq('id', ticket.equipe_responsavel_id)
          .single();

        console.log('\n📝 ===== PREPARANDO MENSAGEM SLA BREACH =====');
        
        // Calcular tempo desde que venceu usando sla_vencido_em
        let tempoVencidoSLA: string;
        
        if (ticket.sla_minutos_restantes > 0) {
          // Ainda não venceu
          const horas = Math.floor(ticket.sla_minutos_restantes / 60);
          const minutos = ticket.sla_minutos_restantes % 60;
          tempoVencidoSLA = `${horas}h ${minutos}min restantes`;
        } else if (ticket.sla_vencido_em) {
          // Calcular há quanto tempo venceu
          const tempoVencidoMs = Date.now() - new Date(ticket.sla_vencido_em).getTime();
          const minutosVencido = Math.floor(tempoVencidoMs / 60000);
          const horas = Math.floor(minutosVencido / 60);
          const minutos = minutosVencido % 60;
          tempoVencidoSLA = `Vencido há ${horas}h ${minutos}min`;
        } else {
          // Fallback (não deveria acontecer)
          tempoVencidoSLA = 'SLA vencido';
        }

        const mensagemSLABreach = processTemplate(templateSLABreach, {
          codigo_ticket: formatTicketTitle(ticket),
          titulo_ticket: ticket.titulo || 'Ticket sem título',
          unidade_id: ticket.unidade_id,
          unidade_nome: unidadeDataSLABreach?.grupo || ticket.unidade_id,
          categoria: ticket.categoria || 'Não informada',
          prioridade: ticket.prioridade,
          status: ticket.status,
          equipe_responsavel: equipeDataSLABreach?.nome || 'Não atribuída',
          descricao_problema: ticket.descricao_problema,
          tempo_restante_sla: tempoVencidoSLA,
          data_abertura: ticket.data_abertura ? new Date(ticket.data_abertura).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informada',
          data_limite_sla: ticket.data_limite_sla ? new Date(ticket.data_limite_sla).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informada'
        });
        console.log('✅ Mensagem preparada com sucesso');

        console.log('\n📱 ===== NORMALIZANDO NÚMERO DE DESTINO =====');
        console.log(`📞 Destino bruto: ${destinoFinal}`);
        console.log(`📞 Tipo do destino: ${typeof destinoFinal}`);
        
        const normalizedPhone = normalizePhoneNumber(destinoFinal);
        console.log(`📞 Número normalizado: ${normalizedPhone}`);
        
        if (!normalizedPhone) {
          console.error('\n❌ ===== FALHA NA NORMALIZAÇÃO DO NÚMERO =====');
          console.error(`❌ Destino original: ${destinoFinal}`);
          console.error(`❌ Não foi possível normalizar o número`);
          console.error(`❌ Verificar se o número está em formato válido`);
          throw new Error(`CRÍTICO: Número de telefone inválido para sla_breach: ${destinoFinal}`);
        }
        
        console.log('\n📤 ===== ENVIANDO MENSAGEM SLA BREACH =====');
        console.log(`📱 Destinatário: ${normalizedPhone}`);
        console.log(`📝 Preview da mensagem (100 chars): ${mensagemSLABreach.substring(0, 100)}...`);
        console.log(`📊 Tamanho da mensagem: ${mensagemSLABreach.length} caracteres`);
        
        try {
          resultadoEnvio = await sendZapiMessage(normalizedPhone, mensagemSLABreach);
          
          console.log('\n✅ ===== RESULTADO DO ENVIO SLA BREACH =====');
          console.log(`✅ Sucesso: ${resultadoEnvio.success}`);
          console.log(`📱 Destino: ${normalizedPhone}`);
          console.log(`📋 Resposta da API:`, JSON.stringify(resultadoEnvio.data, null, 2));
          
          if (!resultadoEnvio.success) {
            console.error('\n❌ ===== ERRO NO ENVIO DO WHATSAPP =====');
            console.error('❌ A mensagem NÃO foi enviada com sucesso');
            console.error('❌ Resposta da Z-API:', resultadoEnvio);
            
            // Incrementar tentativas na notificação se houver ID
            if (notificationId) {
              console.log(`📝 Incrementando tentativas da notificação ${notificationId}...`);
              
              const { data: currentNotification } = await supabase
                .from('notifications_queue')
                .select('attempts')
                .eq('id', notificationId)
                .single();
              
              const attempts = (currentNotification?.attempts || 0) + 1;
              const shouldMarkAsFailed = attempts >= 3;
              
              await supabase
                .from('notifications_queue')
                .update({ 
                  status: shouldMarkAsFailed ? 'failed' : 'pending',
                  attempts,
                  ...(shouldMarkAsFailed && { processed_at: new Date().toISOString() })
                })
                .eq('id', notificationId);
              
              console.log(`📊 Tentativas: ${attempts}${shouldMarkAsFailed ? ' - MARCADA COMO FALHA' : ''}`);
            }
            
            throw new Error(`Falha no envio do WhatsApp: ${resultadoEnvio.error || 'Erro desconhecido'}`);
          }
          
          // ✅ Sucesso - Marcar notificação como enviada ao WhatsApp
          if (notificationId) {
            console.log(`📝 Marcando notificação ${notificationId} como enviada...`);
            
            const { error: updateError } = await supabase
              .from('notifications_queue')
              .update({ 
                status: 'processed',
                sent_to_whatsapp: true,
                processed_at: new Date().toISOString()
              })
              .eq('id', notificationId);
            
            if (updateError) {
              console.error(`❌ Erro ao marcar notificação como enviada:`, updateError);
            } else {
              console.log(`✅ Notificação marcada como enviada ao WhatsApp`);
            }
          }
          
          console.log(`🔔 [sla_breach] ====== FIM DO PROCESSAMENTO ======`);
        } catch (sendError) {
          console.error('\n❌ ===== EXCEÇÃO NO ENVIO =====');
          console.error('❌ Erro:', sendError.message);
          console.error('❌ Stack:', sendError.stack);
          throw sendError; // Re-lançar para não marcar como processado
        }
        
        console.log('✅ ===== SLA BREACH PROCESSADO COM SUCESSO =====\n');
        break;

      case 'crisis_broadcast':
        console.log('Processing crisis_broadcast');
        
        // Para crisis_broadcast, o phone e message já vêm no payload
        const phone = payload.phone;
        const message = payload.message;
        const criseId = payload.crise_id;
        
        if (!phone || !message) {
          throw new Error('Phone and message are required for crisis_broadcast');
        }
        
        const normalizedPhoneCrisis = normalizePhoneNumber(phone);
        if (!normalizedPhoneCrisis) {
          throw new Error(`Número de telefone inválido para crisis_broadcast: ${phone}`);
        }
        
        // Enviar mensagem via WhatsApp
        resultadoEnvio = await sendZapiMessage(normalizedPhoneCrisis, message);
        destinoFinal = phone;
        
        // ✅ Salvar mensagem no histórico de CADA ticket vinculado à crise
        if (resultadoEnvio?.success && criseId) {
          try {
            console.log(`📝 Salvando mensagem de broadcast nos tickets da crise ${criseId}`);
            
            // Buscar todos os tickets vinculados à crise
            const { data: linkedTickets, error: linkError } = await supabase
              .from('crise_ticket_links')
              .select('ticket_id')
              .eq('crise_id', criseId);
            
            if (linkError) {
              console.error('❌ Erro ao buscar tickets vinculados:', linkError);
            } else if (linkedTickets && linkedTickets.length > 0) {
              // Preparar mensagens para inserção em lote
              const ticketMessages = linkedTickets.map(link => ({
                ticket_id: link.ticket_id,
                usuario_id: null, // Mensagem automática do sistema
                mensagem: message,
                direcao: 'saida',
                canal: 'whatsapp',
                anexos: { crisis_broadcast: true, crise_id: criseId }
              }));
              
              // Inserir todas as mensagens de uma vez
              const { error: insertError } = await supabase
                .from('ticket_mensagens')
                .insert(ticketMessages);
              
              if (insertError) {
                console.error('❌ Erro ao salvar mensagens nos tickets:', insertError);
              } else {
                console.log(`✅ Mensagem de broadcast salva em ${linkedTickets.length} ticket(s)`);
              }
            }
          } catch (saveError) {
            console.error('⚠️ Erro ao salvar mensagem nos tickets (não crítico):', saveError);
            // Não falhar o envio se apenas o salvamento falhar
          }
        }
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
