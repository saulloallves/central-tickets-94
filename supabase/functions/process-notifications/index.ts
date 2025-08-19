
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

    // Get Z-API configuration from secrets
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID')
    const zapiInstanceToken = Deno.env.get('ZAPI_INSTANCE_TOKEN')
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')

    if (!zapiInstanceId || !zapiInstanceToken || !zapiClientToken) {
      console.error('Missing Z-API configuration. Required: ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração Z-API incompleta. Verifique as variáveis de ambiente.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
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

    // Função para enviar mensagem via ZAPI
    const sendZapiMessage = async (destination: string, message: string) => {
      // Fixed Z-API endpoint with exact format: https://api.z-api.io/instances/INSTANCE_ID/token/TOKEN/send-text
      const webhookUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiInstanceToken}/send-text`
      
      console.log(`Sending message to: ${destination}`)
      console.log(`Using endpoint: https://api.z-api.io/instances/${zapiInstanceId}/token/****/send-text`)
      
      // Always use {phone, message} payload - destination can be individual number or group ID
      const payload = { phone: destination, message }
      
      console.log('Sending to ZAPI:', { 
        phone: destination, 
        message: message.substring(0, 100) + '...' 
      })

      try {
        const zapiResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Client-Token': zapiClientToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        const result = await zapiResponse.json()
        console.log('ZAPI response status:', zapiResponse.status)
        console.log('ZAPI response:', result)
        
        // Check for HTTP errors
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
        
        // Check for API-level errors in 200 responses
        if (result && result.error) {
          console.error('ZAPI API error in 200 response:', result.error)
          return { 
            success: false, 
            error: `ZAPI error: ${result.error}`,
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
        // Enviar resposta privada para o franqueado (solicitante) via telefone individual
        console.log('Processing resposta_ticket_privado - sending to franqueado (solicitante) phone')
        
        const franqueadoPrivado = await getFranqueadoSolicitante(ticket)
        if (!franqueadoPrivado) {
          console.error('No franqueado (solicitante) data found for ticket')
          result = { success: false, message: 'Franqueado (solicitante) não encontrado para este ticket' }
          break
        }
        
        const normalizedPhone = normalizePhoneNumber(franqueadoPrivado.phone)
        if (!normalizedPhone) {
          console.error('Franqueado (solicitante) phone not found or invalid:', franqueadoPrivado.phone)
          result = { success: false, message: 'Telefone do franqueado (solicitante) não configurado ou inválido' }
          break
        }
        
        if (!textoResposta) {
          console.error('No text response provided')
          result = { success: false, message: 'Texto da resposta não fornecido' }
          break
        }
        
        const privateMessage = `💬 *RESPOSTA DO SEU TICKET*\n\n` +
          `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
          `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n\n` +
          `📝 *Resposta da nossa equipe:*\n${textoResposta}\n\n` +
          `_Se precisar de mais ajuda, responda a esta mensagem._`

        console.log('Sending private message to franqueado (solicitante) phone:', normalizedPhone)
        console.log('Message preview:', privateMessage.substring(0, 100) + '...')
        result = await sendZapiMessage(normalizedPhone, privateMessage)
        break

      case 'resposta_ticket_franqueado':
        // Enviar mensagem para o franqueado (solicitante) via telefone individual (botão "WhatsApp Franqueado")
        console.log('Processing resposta_ticket_franqueado - sending to franqueado (solicitante) phone')
        
        const franqueadoSolicitante = await getFranqueadoSolicitante(ticket)
        if (!franqueadoSolicitante) {
          console.error('No franqueado (solicitante) data found for ticket')
          result = { success: false, message: 'Franqueado (solicitante) não encontrado para este ticket' }
          break
        }
        
        const normalizedFranqueadoPhone = normalizePhoneNumber(franqueadoSolicitante.phone)
        if (!normalizedFranqueadoPhone) {
          console.error('Franqueado (solicitante) phone not found or invalid:', franqueadoSolicitante.phone)
          result = { success: false, message: 'Telefone do franqueado (solicitante) não configurado ou inválido' }
          break
        }
        
        if (!textoResposta) {
          console.error('No text response provided')
          result = { success: false, message: 'Texto da resposta não fornecido' }
          break
        }
        
        const franqueadoMessage = `💬 *RESPOSTA DO SEU TICKET*\n\n` +
          `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
          `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n\n` +
          `📝 *Resposta da nossa equipe:*\n${textoResposta}\n\n` +
          `_Se precisar de mais ajuda, responda a esta mensagem._`

        console.log('Sending message to franqueado (solicitante) phone:', normalizedFranqueadoPhone)
        console.log('Message preview:', franqueadoMessage.substring(0, 100) + '...')
        result = await sendZapiMessage(normalizedFranqueadoPhone, franqueadoMessage)
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
