
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

    // Buscar dados do ticket com título
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades (grupo),
        franqueados (name, phone),
        colaboradores (nome_completo)
      `)
      .eq('id', ticketId)
      .single()

    if (ticketError || !ticket) {
      throw new Error(`Ticket not found: ${ticketError?.message}`)
    }

    // Buscar configurações de notificação
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('*')
      .single()

    if (!settings) {
      console.log('No notification settings found')
      return new Response(
        JSON.stringify({ success: false, message: 'Configurações de notificação não encontradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Função para formatar o título do ticket
    const formatTicketTitle = (ticket: any) => {
      const titulo = ticket.titulo || 'Problema reportado'
      const codigo = ticket.codigo_ticket
      return `${titulo} (${codigo})`
    }

    // Função para enviar mensagem via ZAPI
    const sendZapiMessage = async (groupId: string, message: string) => {
      if (!groupId || !settings.webhook_saida) {
        console.log('Missing groupId or webhook URL')
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
        // Enviar resposta privada para o franqueado
        const franqueado = ticket.franqueados
        if (franqueado?.phone && textoResposta) {
          const message = `💬 *RESPOSTA DO SEU TICKET*\n\n` +
            `📋 *Ticket:* ${formatTicketTitle(ticket)}\n` +
            `🏢 *Unidade:* ${ticket.unidades?.grupo || ticket.unidade_id}\n\n` +
            `📝 *Resposta da nossa equipe:*\n${textoResposta}\n\n` +
            `_Se precisar de mais ajuda, responda a esta mensagem._`

          result = await sendZapiMessage(franqueado.phone.toString(), message)
        } else {
          result = { success: false, message: 'Franqueado não tem telefone cadastrado ou mensagem vazia' }
        }
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
