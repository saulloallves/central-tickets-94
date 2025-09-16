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

  try {
    // Buscar todas as unidades com dados de contato da tabela local
    const { data: unidades, error: unidadesError } = await supabase
      .from('unidades')
      .select('id, grupo, codigo_grupo, telefone, email')
      .not('telefone', 'is', null)

    if (unidadesError) {
      console.error('Error fetching unidades:', unidadesError)
      throw unidadesError
    }

    const preview = {
      total_unidades: unidades?.length || 0,
      atendentes_encontrados: 0,
      unidades_com_atendente: [],
      novos_atendentes: [],
      conflitos: []
    }

    if (unidades && unidades.length > 0) {
      // Buscar atendentes existentes para detectar conflitos
      const { data: atendentesExistentes } = await supabase
        .from('atendentes')
        .select('nome, telefone, email, tipo')

      const existentes = new Map()
      atendentesExistentes?.forEach(a => {
        existentes.set(`${a.nome}-${a.tipo}`, a)
      })

      for (const unidade of unidades) {
        const nomeAtendente = `Atendente ${unidade.grupo || unidade.id}`
        
        preview.atendentes_encontrados++
        preview.unidades_com_atendente.push({
          unidade_id: unidade.id,
          grupo: unidade.grupo,
          atendente: nomeAtendente,
          telefone: unidade.telefone,
          email: unidade.email
        })

        const key = `${nomeAtendente}-concierge`
        if (existentes.has(key)) {
          preview.conflitos.push({
            nome: nomeAtendente,
            tipo: 'concierge',
            acao: 'atualizar'
          })
        } else {
          preview.novos_atendentes.push({
            nome: nomeAtendente,
            tipo: 'concierge',
            telefone: unidade.telefone,
            email: unidade.email,
            unidade_id: unidade.id
          })
        }
      }
    }

    console.log('📊 Preview gerado:', preview)

    return new Response(
      JSON.stringify({ preview }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error in previewSyncData:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function syncAtendentes() {
  console.log('🔄 Iniciando sincronização de atendentes...')

  try {
    // 1. Buscar todas as unidades com dados de contato
    const { data: unidades, error: unidadesError } = await supabase
      .from('unidades')
      .select('id, grupo, codigo_grupo, telefone, email')
      .not('telefone', 'is', null)

    if (unidadesError) {
      console.error('Error fetching unidades:', unidadesError)
      throw unidadesError
    }

    if (!unidades || unidades.length === 0) {
      console.log('⚠️ Nenhuma unidade com dados de atendente encontrada')
      return new Response(
        JSON.stringify({ 
          message: 'Nenhuma unidade com dados de atendente encontrada',
          synced: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Encontradas ${unidades.length} unidades com dados de atendente`)

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
        // Criar nome baseado no grupo ou ID da unidade
        const nomeAtendente = `Atendente ${unidade.grupo || unidade.id}`
        
        await processAtendente({
          nome: nomeAtendente,
          telefone: unidade.telefone?.toString(),
          email: unidade.email,
          tipo: 'concierge',
          unidade_id: unidade.id,
          grupo: unidade.grupo
        }, stats)

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
  } catch (error) {
    console.error('❌ Error in syncAtendentes:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
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