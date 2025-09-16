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
    console.log('🚀 Iniciando importação de atendentes das unidades...')

    // 1. Buscar TODAS as unidades da tabela externa
    const { data: unidades, error: unidadesError } = await supabase
      .from('unidades')
      .select('id, grupo, codigo_grupo, concierge_name, concierge_phone, email, uf, cidade, endereco')

    if (unidadesError) {
      console.error('❌ Erro ao buscar unidades:', unidadesError)
      throw unidadesError
    }

    if (!unidades || unidades.length === 0) {
      console.log('⚠️ Nenhuma unidade encontrada')
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Nenhuma unidade encontrada',
          stats: { total: 0, criados: 0, atualizados: 0, associacoes: 0, erros: [] }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Encontradas ${unidades.length} unidades para processar`)

    const stats = {
      total: unidades.length,
      criados: 0,
      atualizados: 0,
      associacoes: 0,
      erros: []
    }

    // 2. Processar cada unidade
    for (const unidade of unidades) {
      try {
        await processarUnidade(unidade, stats)
      } catch (error) {
        console.error(`❌ Erro processando unidade ${unidade.id}:`, error)
        stats.erros.push({
          unidade_id: unidade.id,
          grupo: unidade.grupo,
          erro: error.message
        })
      }
    }

    // 3. Log final
    console.log('✅ Importação concluída:', stats)

    // 4. Log de auditoria
    await supabase.functions.invoke('system-log', {
      body: {
        tipo_log: 'sistema',
        entidade_afetada: 'atendentes',
        entidade_id: 'import_all_unidades',
        acao_realizada: 'Importação completa de atendentes das unidades',
        dados_novos: stats
      }
    }).catch(err => console.log('Log de auditoria falhou:', err))

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Importação concluída com sucesso',
        stats 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erro geral na importação:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processarUnidade(unidade: any, stats: any) {
  const { id: unidade_id, grupo, concierge_name, concierge_phone, email, uf, cidade } = unidade
  
  // Usar o nome do concierge ou gerar nome baseado no grupo/cidade
  const nomeAtendente = concierge_name 
    ? concierge_name.trim()
    : grupo 
      ? `Atendente ${grupo}`.trim()
      : `Atendente ${cidade || unidade_id}`.trim()

  console.log(`🔄 Processando: ${nomeAtendente} (${unidade_id})`)

  // 1. Verificar se atendente já existe (por nome E unidade)
  const { data: atendenteExistente, error: searchError } = await supabase
    .from('atendentes')
    .select('id, nome')
    .eq('nome', nomeAtendente)
    .maybeSingle()

  if (searchError) {
    console.error('Erro buscando atendente existente:', searchError)
    throw searchError
  }

  let atendenteId: string

  if (atendenteExistente) {
    // Atualizar atendente existente
    const { data: updated, error: updateError } = await supabase
      .from('atendentes')
      .update({
        telefone: concierge_phone?.toString() || null,
        email: email || null,
        status: 'ativo',
        ativo: true,
        observacoes: `Unidade: ${grupo || cidade || unidade_id} - ${uf || ''} - Atualizado automaticamente`,
        updated_at: new Date().toISOString()
      })
      .eq('id', atendenteExistente.id)
      .select('id')
      .single()

    if (updateError) {
      console.error('Erro atualizando atendente:', updateError)
      throw updateError
    }

    atendenteId = updated.id
    stats.atualizados++
    console.log(`✅ Atendente atualizado: ${nomeAtendente}`)

  } else {
    // Criar novo atendente
    const { data: created, error: createError } = await supabase
      .from('atendentes')
      .insert({
        nome: nomeAtendente,
        telefone: concierge_phone?.toString() || null,
        email: email || null,
        tipo: 'concierge',
        status: 'ativo',
        capacidade_maxima: 5,
        capacidade_atual: 0,
        ativo: true,
        observacoes: `Unidade: ${grupo || cidade || unidade_id} - ${uf || ''} - Importado automaticamente`
      })
      .select('id')
      .single()

    if (createError) {
      console.error('Erro criando atendente:', createError)
      throw createError
    }

    atendenteId = created.id
    stats.criados++
    console.log(`✅ Novo atendente criado: ${nomeAtendente}`)
  }

  // 2. Criar/verificar associação com unidade
  const { error: associacaoError } = await supabase
    .from('atendente_unidades')
    .upsert({
      atendente_id: atendenteId,
      unidade_id: unidade_id,
      is_preferencial: true,
      prioridade: 1,
      ativo: true
    }, {
      onConflict: 'atendente_id,unidade_id'
    })

  if (associacaoError) {
    console.error('Erro criando associação:', associacaoError)
    throw associacaoError
  }

  stats.associacoes++
  console.log(`✅ Associação criada: ${nomeAtendente} -> ${unidade_id}`)
}