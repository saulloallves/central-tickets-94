import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { tipo, unidade_id, motivo } = await req.json()
    console.log(`🔄 Redistribuindo fila - Tipo: ${tipo}, Unidade: ${unidade_id}`)

    // 1. Buscar atendentes disponíveis para o tipo e unidade
    const { data: atendentesDisponiveis, error: atendenteError } = await supabase
      .from('atendentes')
      .select(`
        id, nome, capacidade_maxima, capacidade_atual,
        atendente_unidades!inner(unidade_id, is_preferencial, prioridade)
      `)
      .eq('tipo', tipo)
      .eq('status', 'ativo')
      .eq('ativo', true)
      .eq('atendente_unidades.unidade_id', unidade_id)
      .eq('atendente_unidades.ativo', true)
      .order('atendente_unidades.is_preferencial', { ascending: false })
      .order('atendente_unidades.prioridade', { ascending: true })

    if (atendenteError) throw atendenteError

    // 2. Buscar chamados em fila para redistribuir
    const { data: chamadosEmFila, error: chamadosError } = await supabase
      .from('chamados')
      .select('*')
      .eq('tipo_atendimento', tipo)
      .eq('unidade_id', unidade_id)
      .eq('status', 'em_fila')
      .order('criado_em', { ascending: true })

    if (chamadosError) throw chamadosError

    console.log(`📊 Encontrados ${atendentesDisponiveis.length} atendentes e ${chamadosEmFila.length} chamados`)

    if (!atendentesDisponiveis.length) {
      console.log('⚠️ Nenhum atendente disponível')
      return new Response(
        JSON.stringify({ 
          redistributed: 0, 
          message: 'Nenhum atendente disponível para redistribuição' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let redistribuidos = 0
    const notificacoes = []

    // 3. Redistribuir chamados para atendentes com capacidade
    for (const chamado of chamadosEmFila) {
      // Encontrar atendente com menor carga atual
      const atendenteDisponivel = atendentesDisponiveis
        .filter(a => a.capacidade_atual < a.capacidade_maxima)
        .sort((a, b) => {
          // Priorizar por: preferencial -> menor carga atual -> prioridade
          if (a.atendente_unidades[0].is_preferencial !== b.atendente_unidades[0].is_preferencial) {
            return a.atendente_unidades[0].is_preferencial ? -1 : 1
          }
          if (a.capacidade_atual !== b.capacidade_atual) {
            return a.capacidade_atual - b.capacidade_atual
          }
          return a.atendente_unidades[0].prioridade - b.atendente_unidades[0].prioridade
        })[0]

      if (atendenteDisponivel) {
        // Atualizar chamado com atendente
        const { error: updateError } = await supabase
          .from('chamados')
          .update({
            atendente_id: atendenteDisponivel.id,
            atendente_nome: atendenteDisponivel.nome,
            status: 'em_atendimento'
          })
          .eq('id', chamado.id)

        if (updateError) {
          console.error(`❌ Erro ao atualizar chamado ${chamado.id}:`, updateError)
          continue
        }

        // Incrementar capacidade atual do atendente
        await supabase
          .from('atendentes')
          .update({ 
            capacidade_atual: atendenteDisponivel.capacidade_atual + 1 
          })
          .eq('id', atendenteDisponivel.id)

        // Atualizar contador local
        atendenteDisponivel.capacidade_atual += 1
        redistribuidos++

        console.log(`✅ Chamado ${chamado.id} redistribuído para ${atendenteDisponivel.nome}`)

        // Preparar notificação para o cliente
        notificacoes.push({
          chamado_id: chamado.id,
          telefone: chamado.telefone,
          atendente_nome: atendenteDisponivel.nome,
          tipo: tipo
        })
      }
    }

    // 4. Enviar notificações via Z-API (se houver redistribuições)
    if (notificacoes.length > 0) {
      await enviarNotificacoesRedistribuicao(notificacoes)
    }

    // 5. Log da operação
    await supabase.functions.invoke('system-log', {
      body: {
        tipo_log: 'sistema',
        entidade_afetada: 'chamados',
        entidade_id: `redistribuicao_${tipo}_${unidade_id}`,
        acao_realizada: `Redistribuição de fila executada`,
        dados_novos: {
          tipo,
          unidade_id,
          motivo,
          chamados_redistribuidos: redistribuidos,
          atendentes_disponiveis: atendentesDisponiveis.length
        }
      }
    })

    console.log(`✅ Redistribuição concluída: ${redistribuidos} chamados`)

    return new Response(
      JSON.stringify({ 
        redistributed: redistribuidos,
        available_agents: atendentesDisponiveis.length,
        notifications_sent: notificacoes.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro na redistribuição:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function enviarNotificacoesRedistribuicao(notificacoes: any[]) {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID")
  const apiKey = Deno.env.get("ZAPI_API_KEY")
  
  if (!instanceId || !apiKey) {
    console.log('⚠️ Z-API não configurado, pulando notificações')
    return
  }

  for (const notificacao of notificacoes) {
    try {
      const mensagem = `🔄 *Atualização do seu atendimento*\n\n` +
        `Seu ${notificacao.tipo === 'concierge' ? 'atendimento concierge' : 'suporte técnico DFCom'} ` +
        `foi direcionado para *${notificacao.atendente_nome}*.\n\n` +
        `Em breve você será atendido(a). Obrigado pela paciência! 😊`

      const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${apiKey}/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: notificacao.telefone,
          message: mensagem
        })
      })

      if (response.ok) {
        console.log(`✅ Notificação enviada para ${notificacao.telefone}`)
      } else {
        console.error(`❌ Erro ao enviar notificação: ${await response.text()}`)
      }
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação para ${notificacao.telefone}:`, error)
    }
  }
}