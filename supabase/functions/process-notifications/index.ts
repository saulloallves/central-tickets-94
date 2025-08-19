
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { ticketId, type, textoResposta } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar dados do ticket
    console.log('Fetching ticket data for ID:', ticketId)
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades (id, grupo, id_grupo_azul, id_grupo_branco, id_grupo_vermelho),
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

    // Buscar dados do franqueado separadamente se necessário
    let franqueado = null
    if (ticket.franqueado_id && type === 'resposta_ticket_privado') {
      console.log('Fetching franqueado data for ID:', ticket.franqueado_id)
      const { data: franqueadoData, error: franqueadoError } = await supabase
        .from('franqueados')
        .select('name, phone')
        .eq('id', ticket.franqueado_id)
        .single()
      
      if (franqueadoError) {
        console.error('Franqueado error:', franqueadoError)
        return new Response(
          JSON.stringify({ success: false, message: 'Franqueado não encontrado' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }
      
      franqueado = franqueadoData
      console.log('Franqueado found:', { name: franqueado?.name, hasPhone: !!franqueado?.phone })
    }

    // Get Z-API configuration from secrets
    const zapiBaseUrl = Deno.env.get('ZAPI_BASE_URL')
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID')
    const zapiInstanceToken = Deno.env.get('ZAPI_INSTANCE_TOKEN')

    if (!zapiBaseUrl || !zapiInstanceId || !zapiInstanceToken) {
      console.error('Missing Z-API configuration. Required: ZAPI_BASE_URL, ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração Z-API incompleta. Verifique as variáveis de ambiente.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Buscar configurações de notificação para delays e retries
    const { data: settingsData } = await supabase
      .from('notification_settings')
      .select('*')
      .single()

    const settings = settingsData || {
      delay_mensagem: 2000,
      limite_retentativas: 3
    }

    console.log('Using Z-API configuration from environment secrets')

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

    // Função para detectar se é ID de grupo
    const isGroupId = (id: string): boolean => {
      return id.includes('@g.us') || id.includes('-group') || id.length > 15
    }

    // Função para enviar mensagem via ZAPI
    const sendZapiMessage = async (destination: string, message: string) => {
      const isGroup = isGroupId(destination)
      const endpoint = isGroup ? 'send-text-group' : 'send-text'
      const webhookUrl = `${zapiBaseUrl}/instances/${zapiInstanceId}/token/${zapiInstanceToken}/${endpoint}`
      
      console.log(`Sending ${isGroup ? 'group' : 'individual'} message to:`, destination)
      console.log(`Using endpoint: ${zapiBaseUrl}/instances/${zapiInstanceId}/token/***/${endpoint}`)
      
      const payload = isGroup 
        ? { groupId: destination, message }
        : { phone: destination, message }
      
      console.log('Sending to ZAPI:', { 
        [isGroup ? 'groupId' : 'phone']: destination, 
        message: message.substring(0, 100) + '...' 
      })

      try {
        const zapiResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        const result = await zapiResponse.json()
        console.log('ZAPI response status:', zapiResponse.status)
        console.log('ZAPI response:', result)
        
        if (!zapiResponse.ok) {
          const errorMsg = result?.error || result?.message || `HTTP ${zapiResponse.status} ${zapiResponse.statusText}`
          console.error('ZAPI HTTP error:', errorMsg)
          return { 
            success: false, 
            error: `ZAPI API error: ${errorMsg}`,
            status: zapiResponse.status,
            data: result
          }
        }
        
        return { success: true, data: result, status: zapiResponse.status }
      } catch (error) {
        console.error('ZAPI network error:', error)
        return { 
          success: false, 
          error: `Erro de conexão com ZAPI: ${error.message}` 
        }
      }
    }

    let result = { success: false, message: 'Tipo de notificação não implementado' }

    switch (type) {
      case 'ticket_criado':
        // Usar grupo branco como principal, com fallback para azul
        const groupForNewTicket = ticket.unidades?.id_grupo_branco || ticket.unidades?.id_grupo_azul
        console.log('Using group for new ticket:', { branco: ticket.unidades?.id_grupo_branco, azul: ticket.unidades?.id_grupo_azul, selected: groupForNewTicket })
        
        if (groupForNewTicket) {
          const message = `🎫 *NOVO TICKET*\n\n` +
            `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
            `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n` +
            `⏰ *Criado:* ${new Date(ticket.created_at).toLocaleString('pt-BR')}\n` +
            `🔥 *Prioridade:* ${ticket.prioridade.toUpperCase()}\n\n` +
            `📝 *Problema:*\n${ticket.descricao_problema}`

          result = await sendZapiMessage(groupForNewTicket, message)
        } else {
          console.error('No group ID found for ticket creation notification')
          result = { success: false, message: 'Grupo WhatsApp não configurado para esta unidade' }
        }
        break

      case 'resposta_ticket':
        // Usar grupo branco como principal, com fallback para azul
        const groupForResponse = ticket.unidades?.id_grupo_branco || ticket.unidades?.id_grupo_azul
        console.log('Using group for response:', { branco: ticket.unidades?.id_grupo_branco, azul: ticket.unidades?.id_grupo_azul, selected: groupForResponse })
        
        if (groupForResponse && textoResposta) {
          const message = `💬 *RESPOSTA DO TICKET*\n\n` +
            `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
            `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n\n` +
            `📝 *Resposta:*\n${textoResposta}`

          result = await sendZapiMessage(groupForResponse, message)
        } else if (!groupForResponse) {
          console.error('No group ID found for ticket response notification')
          result = { success: false, message: 'Grupo WhatsApp não configurado para esta unidade' }
        } else {
          console.error('No response text provided')
          result = { success: false, message: 'Texto da resposta não fornecido' }
        }
        break

      case 'resposta_ticket_privado':
        // Enviar resposta privada para o franqueado via telefone individual
        console.log('Processing resposta_ticket_privado - sending to individual phone')
        
        if (!franqueado) {
          console.error('No franqueado data found for ticket')
          result = { success: false, message: 'Dados do franqueado não encontrados no ticket' }
          break
        }
        
        const normalizedPhone = normalizePhoneNumber(franqueado.phone)
        if (!normalizedPhone) {
          console.error('Franqueado phone not found or invalid:', franqueado.phone)
          result = { success: false, message: 'Franqueado não tem telefone válido cadastrado' }
          break
        }
        
        if (!textoResposta) {
          console.error('No text response provided')
          result = { success: false, message: 'Texto da resposta não fornecido' }
          break
        }

        if (!settings?.webhook_saida) {
          console.error('No webhook URL configured')
          result = { success: false, message: 'URL do webhook ZAPI não configurada. Configure em Configurações > Notificações.' }
          break
        }
        
        const privateMessage = `💬 *RESPOSTA DO SEU TICKET*\n\n` +
          `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
          `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n\n` +
          `📝 *Resposta da nossa equipe:*\n${textoResposta}\n\n` +
          `_Se precisar de mais ajuda, responda a esta mensagem._`

        console.log('Sending private message to normalized phone:', normalizedPhone)
        console.log('Message preview:', privateMessage.substring(0, 100) + '...')
        result = await sendZapiMessage(normalizedPhone, privateMessage)
        break

      case 'sla_half':
        if (ticket.unidades?.id_grupo_vermelho) {
          const message = `⚠️ *ALERTA SLA - 50%*\n\n` +
            `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
            `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n` +
            `⏰ *Limite SLA:* ${new Date(ticket.data_limite_sla).toLocaleString('pt-BR')}\n\n` +
            `⚠️ *Este ticket atingiu 50% do prazo de SLA*`

          result = await sendZapiMessage(ticket.unidades.id_grupo_vermelho, message)
        }
        break

      case 'sla_breach':
        if (ticket.unidades?.id_grupo_vermelho) {
          const message = `🚨 *SLA VENCIDO*\n\n` +
            `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
            `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n` +
            `⏰ *Venceu em:* ${new Date(ticket.data_limite_sla).toLocaleString('pt-BR')}\n\n` +
            `🚨 *AÇÃO URGENTE NECESSÁRIA*`

          result = await sendZapiMessage(ticket.unidades.id_grupo_vermelho, message)
        }
        break

      case 'crisis':
        if (ticket.unidades?.id_grupo_vermelho) {
          const message = `🔴 *TICKET DE CRISE*\n\n` +
            `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
            `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n` +
            `⏰ *Criado:* ${new Date(ticket.created_at).toLocaleString('pt-BR')}\n\n` +
            `🔴 *PRIORIDADE MÁXIMA - ATENDER IMEDIATAMENTE*\n\n` +
            `📝 *Problema:*\n${ticket.descricao_problema}`

          result = await sendZapiMessage(ticket.unidades.id_grupo_vermelho, message)
        }
        break
    }

    // Registrar log do envio
    await supabase
      .from('escalation_logs')
      .insert({
        ticket_id: ticketId,
        event_type: type,
        message: 'WhatsApp notification sent',
        response: result,
        canal: 'zapi'
      })

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 400
      }
    )

  } catch (error) {
    console.error('Error in process-notifications:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
