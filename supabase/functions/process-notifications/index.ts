
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
        unidades (id, grupo, id_grupo_azul, id_grupo_vermelho),
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

    // Buscar configurações de notificação
    let settings = null;
    const { data: settingsData, error: settingsError } = await supabase
      .from('notification_settings')
      .select('*')
      .single()

    if (settingsError || !settingsData) {
      console.log('No notification settings found, using defaults')
      // Usar configurações padrão se não existir na base
      settings = {
        webhook_saida: Deno.env.get('ZAPI_BASE_URL') || null,
        delay_mensagem: 2000,
        limite_retentativas: 3,
        numero_remetente: null
      }
    } else {
      settings = settingsData
      console.log('Using notification settings from database')
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
      
      // Se tem 11 dígitos e começa com 55, já tem código do país
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
    const sendZapiMessage = async (groupId: string, message: string) => {
      console.log('Attempting to send ZAPI message to:', groupId)
      if (!groupId || !settings?.webhook_saida) {
        console.log('Missing groupId or webhook URL:', { groupId: !!groupId, webhook: !!settings?.webhook_saida })
        return { success: false, error: 'Missing configuration' }
      }

      const zapiPayload = {
        phone: groupId,
        message: message,
        delayMessage: settings.delay_mensagem || 2000
      }

      console.log('Sending to ZAPI:', { groupId, message: message.substring(0, 100) + '...' })

      try {
        const zapiResponse = await fetch(settings.webhook_saida, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': Deno.env.get('ZAPI_CLIENT_TOKEN') || '',
            'Instance-Token': Deno.env.get('ZAPI_INSTANCE_TOKEN') || ''
          },
          body: JSON.stringify(zapiPayload)
        })

        const result = await zapiResponse.json()
        console.log('ZAPI response:', result)
        return { success: zapiResponse.ok, data: result }
      } catch (error) {
        console.error('ZAPI error:', error)
        return { success: false, error: error.message }
      }
    }

    let result = { success: false, message: 'Tipo de notificação não implementado' }

    switch (type) {
      case 'ticket_criado':
        if (ticket.unidades?.id_grupo_azul) {
          const message = `🎫 *NOVO TICKET*\n\n` +
            `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
            `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n` +
            `⏰ *Criado:* ${new Date(ticket.created_at).toLocaleString('pt-BR')}\n` +
            `🔥 *Prioridade:* ${ticket.prioridade.toUpperCase()}\n\n` +
            `📝 *Problema:*\n${ticket.descricao_problema}`

          result = await sendZapiMessage(ticket.unidades.id_grupo_azul, message)
        }
        break

      case 'resposta_ticket':
        if (ticket.unidades?.id_grupo_azul && textoResposta) {
          const message = `💬 *RESPOSTA DO TICKET*\n\n` +
            `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
            `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n\n` +
            `📝 *Resposta:*\n${textoResposta}`

          result = await sendZapiMessage(ticket.unidades.id_grupo_azul, message)
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
