import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const externalSupabase = createClient(
  Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '',
  Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action = 'sync' } = await req.json().catch(() => ({}))
    console.log(`🔄 Sync Atendentes - Action: ${action}`)

    switch (action) {
      case 'sync':
        return await syncAtendentes()
      case 'preview':
        return await previewSyncData()
      default:
        throw new Error(`Ação não reconhecida: ${action}`)
    }
  } catch (error) {
    console.error('❌ Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function previewSyncData() {
  console.log('👀 Buscando dados para preview...')

  // Buscar todas as unidades com dados de atendentes
  const { data: unidades, error: unidadesError } = await externalSupabase
    .from('unidades')
    .select('id, grupo, codigo_grupo, concierge_name, concierge_phone, dfcom_name, dfcom_phone')
    .not('concierge_name', 'is', null)
    .or('dfcom_name.not.is.null')

  if (unidadesError) throw unidadesError

  const preview = {
    total_unidades: unidades?.length || 0,
    atendentes_concierge: 0,
    atendentes_dfcom: 0,
    unidades_com_concierge: [],
    unidades_com_dfcom: [],
    novos_atendentes: [],
    conflitos: []
  }

  if (unidades) {
    // Buscar atendentes existentes para detectar conflitos
    const { data: atendentesExistentes } = await supabase
      .from('atendentes')
      .select('nome, telefone, email, tipo')

    const existentes = new Map()
    atendentesExistentes?.forEach(a => {
      existentes.set(`${a.nome}-${a.tipo}`, a)
    })

    for (const unidade of unidades) {
      // Processar Concierge
      if (unidade.concierge_name) {
        preview.atendentes_concierge++
        preview.unidades_com_concierge.push({
          unidade_id: unidade.id,
          grupo: unidade.grupo,
          atendente: unidade.concierge_name,
          telefone: unidade.concierge_phone
        })

        const key = `${unidade.concierge_name}-concierge`
        if (existentes.has(key)) {
          preview.conflitos.push({
            nome: unidade.concierge_name,
            tipo: 'concierge',
            acao: 'atualizar'
          })
        } else {
          preview.novos_atendentes.push({
            nome: unidade.concierge_name,
            tipo: 'concierge',
            telefone: unidade.concierge_phone,
            unidade_id: unidade.id
          })
        }
      }

      // Processar DFCom
      if (unidade.dfcom_name) {
        preview.atendentes_dfcom++
        preview.unidades_com_dfcom.push({
          unidade_id: unidade.id,
          grupo: unidade.grupo,
          atendente: unidade.dfcom_name,
          telefone: unidade.dfcom_phone
        })

        const key = `${unidade.dfcom_name}-dfcom`
        if (existentes.has(key)) {
          preview.conflitos.push({
            nome: unidade.dfcom_name,
            tipo: 'dfcom',
            acao: 'atualizar'
          })
        } else {
          preview.novos_atendentes.push({
            nome: unidade.dfcom_name,
            tipo: 'dfcom',
            telefone: unidade.dfcom_phone,
            unidade_id: unidade.id
          })
        }
      }
    }
  }

  console.log('📊 Preview gerado:', preview)

  return new Response(
    JSON.stringify({ preview }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function syncAtendentes() {
  console.log('🔄 Iniciando sincronização de atendentes...')

  // 1. Buscar todas as unidades com dados de atendentes
  const { data: unidades, error: unidadesError } = await externalSupabase
    .from('unidades')
    .select('id, grupo, codigo_grupo, concierge_name, concierge_phone, dfcom_name, dfcom_phone')
    .not('concierge_name', 'is', null)
    .or('dfcom_name.not.is.null')

  if (unidadesError) throw unidadesError

  if (!unidades || unidades.length === 0) {
    console.log('⚠️ Nenhuma unidade com atendentes encontrada')
    return new Response(
      JSON.stringify({ 
        message: 'Nenhuma unidade com atendentes encontrada',
        synced: 0 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`📋 Encontradas ${unidades.length} unidades com atendentes`)

  const stats = {
    processados: 0,
    criados: 0,
    atualizados: 0,
    associacoes_criadas: 0,
    erros: []
  }

  // 2. Processar cada unidade
  for (const unidade of unidades) {
    stats.processados++

    try {
      // Processar Concierge
      if (unidade.concierge_name) {
        await processAtendente({
          nome: unidade.concierge_name,
          telefone: unidade.concierge_phone,
          tipo: 'concierge',
          unidade_id: unidade.id,
          grupo: unidade.grupo
        }, stats)
      }

      // Processar DFCom
      if (unidade.dfcom_name) {
        await processAtendente({
          nome: unidade.dfcom_name,
          telefone: unidade.dfcom_phone,
          tipo: 'dfcom',
          unidade_id: unidade.id,
          grupo: unidade.grupo
        }, stats)
      }

    } catch (error) {
      console.error(`❌ Erro processando unidade ${unidade.id}:`, error)
      stats.erros.push({
        unidade_id: unidade.id,
        erro: error.message
      })
    }
  }

  // 3. Log de auditoria
  await supabase.functions.invoke('system-log', {
    body: {
      tipo_log: 'sistema',
      entidade_afetada: 'atendentes',
      entidade_id: 'sync_external',
      acao_realizada: 'Sincronização de atendentes da tabela externa',
      dados_novos: stats
    }
  })

  console.log('✅ Sincronização concluída:', stats)

  return new Response(
    JSON.stringify({ 
      message: 'Sincronização concluída',
      stats 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function processAtendente(data: any, stats: any) {
  const { nome, telefone, tipo, unidade_id, grupo } = data

  console.log(`🔍 Processando ${tipo}: ${nome} para unidade ${unidade_id}`)

  // Verificar se atendente já existe
  const { data: existente, error: searchError } = await supabase
    .from('atendentes')
    .select('id')
    .eq('nome', nome)
    .eq('tipo', tipo)
    .maybeSingle()

  if (searchError) throw searchError

  let atendenteId: string

  if (existente) {
    // Atualizar atendente existente
    const { data: updated, error: updateError } = await supabase
      .from('atendentes')
      .update({ 
        telefone: telefone || null,
        status: 'ativo',
        ativo: true
      })
      .eq('id', existente.id)
      .select('id')
      .single()

    if (updateError) throw updateError

    atendenteId = updated.id
    stats.atualizados++
    console.log(`✅ Atendente atualizado: ${nome}`)

  } else {
    // Criar novo atendente
    const { data: created, error: createError } = await supabase
      .from('atendentes')
      .insert({
        nome,
        telefone: telefone || null,
        tipo,
        status: 'ativo',
        capacidade_maxima: tipo === 'concierge' ? 5 : 4, // Default capacity
        observacoes: `Importado da tabela externa - Grupo: ${grupo}`
      })
      .select('id')
      .single()

    if (createError) throw createError

    atendenteId = created.id
    stats.criados++
    console.log(`✅ Novo atendente criado: ${nome}`)
  }

  // Criar/verificar associação com unidade
  const { error: associacaoError } = await supabase
    .from('atendente_unidades')
    .upsert({
      atendente_id: atendenteId,
      unidade_id,
      is_preferencial: true, // Primeira associação é preferencial
      prioridade: 1,
      ativo: true
    }, {
      onConflict: 'atendente_id,unidade_id'
    })

  if (associacaoError) throw associacaoError

  stats.associacoes_criadas++
  console.log(`✅ Associação criada: ${nome} -> ${unidade_id}`)
}