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

    // 1. Buscar unidades com dados dos concierges (JOIN com franqueados)
    const { data: unidadesData, error: unidadesError } = await supabase
      .from('unidades')
      .select(`
        id,
        grupo,
        codigo_grupo,
        email,
        uf,
        cidade,
        endereco
      `)

    if (unidadesError) {
      console.error('❌ Erro ao buscar unidades:', unidadesError)
      throw unidadesError
    }

    if (!unidadesData || unidadesData.length === 0) {
      console.log('⚠️ Nenhuma unidade encontrada')
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Nenhuma unidade encontrada',
          stats: { total: 0, processadas: 0, criados: 0, atualizados: 0, associacoes: 0, sem_concierge: 0, erros: [] }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Encontradas ${unidadesData.length} unidades`)

    // 2. Buscar franqueados para obter dados dos concierges
    const { data: franqueadosData, error: franqueadosError } = await supabase
      .from('franqueados')
      .select('name, phone, email, unit_code')

    if (franqueadosError) {
      console.error('❌ Erro ao buscar franqueados:', franqueadosError)
      throw franqueadosError
    }

    console.log(`📊 Encontrados ${franqueadosData?.length || 0} franqueados`)

    // 3. Criar mapa de franqueados por unit_code
    const franqueadosMap = new Map()
    franqueadosData?.forEach(franqueado => {
      if (franqueado.unit_code) {
        // unit_code é um jsonb, pode conter múltiplos códigos
        const unitCodes = Array.isArray(franqueado.unit_code) 
          ? franqueado.unit_code 
          : typeof franqueado.unit_code === 'object' 
            ? Object.keys(franqueado.unit_code)
            : [franqueado.unit_code]
        
        unitCodes.forEach(code => {
          if (code && typeof code === 'string') {
            franqueadosMap.set(code, franqueado)
          }
        })
      }
    })

    const stats = {
      total: unidadesData.length,
      processadas: 0,
      criados: 0,
      atualizados: 0,
      associacoes: 0,
      sem_concierge: 0,
      duplicatas_telefone: 0,
      duplicatas_email: 0,
      erros: []
    }

    // 4. Processar cada unidade
    for (const unidade of unidadesData) {
      try {
        await processarUnidade(unidade, franqueadosMap, stats)
        stats.processadas++
      } catch (error) {
        console.error(`❌ Erro processando unidade ${unidade.id}:`, error)
        stats.erros.push({
          unidade_id: unidade.id,
          grupo: unidade.grupo,
          erro: error.message
        })
      }
    }

    // 5. Log final
    console.log('✅ Importação concluída:', stats)

    // 6. Log de auditoria
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

async function processarUnidade(unidade: any, franqueadosMap: Map<string, any>, stats: any) {
  const { id: unidade_id, grupo, codigo_grupo, email, uf, cidade } = unidade
  
  // 1. Buscar dados do concierge pelo código da unidade
  const concierge = franqueadosMap.get(codigo_grupo) || franqueadosMap.get(unidade_id)
  
  if (!concierge) {
    console.log(`⚠️ Unidade ${grupo} (${codigo_grupo}) sem concierge - pulando`)
    stats.sem_concierge++
    return
  }

  const { name: concierge_name, phone: concierge_phone, email: concierge_email } = concierge
  
  // 2. Definir nome do atendente
  const nomeAtendente = concierge_name?.trim() || `Atendente ${grupo || cidade || unidade_id}`.trim()

  console.log(`🔄 Processando: ${nomeAtendente} (${unidade_id}) - Tel: ${concierge_phone}`)

  // 3. Verificar se atendente já existe (por telefone primeiro, depois email)
  let atendenteExistente = null
  let tipoMatch = null
  
  if (concierge_phone) {
    const normalizedPhone = concierge_phone.toString().replace(/\D/g, '')
    if (normalizedPhone.length >= 10) {
      const { data } = await supabase
        .from('atendentes')
        .select('id, nome, telefone')
        .eq('telefone', concierge_phone)
        .maybeSingle()
      
      if (data) {
        atendenteExistente = data
        tipoMatch = 'telefone'
        stats.duplicatas_telefone++
      }
    }
  }
  
  if (!atendenteExistente && concierge_email) {
    const { data } = await supabase
      .from('atendentes')
      .select('id, nome, email')
      .eq('email', concierge_email)
      .maybeSingle()
    
    if (data) {
      atendenteExistente = data
      tipoMatch = 'email'
      stats.duplicatas_email++
    }
  }

  let atendenteId: string

  if (atendenteExistente) {
    // 4. Atualizar atendente existente
    console.log(`🔄 Atualizando atendente existente (match por ${tipoMatch}): ${atendenteExistente.nome}`)
    
    const { data: updated, error: updateError } = await supabase
      .from('atendentes')
      .update({
        nome: nomeAtendente,
        telefone: concierge_phone?.toString() || null,
        email: concierge_email || null,
        status: 'ativo',
        ativo: true,
        observacoes: `Unidade: ${grupo || cidade || unidade_id} - ${uf || ''} - Atualizado automaticamente (match: ${tipoMatch})`,
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
    // 5. Criar novo atendente
    console.log(`➕ Criando novo atendente: ${nomeAtendente}`)
    
    const { data: created, error: createError } = await supabase
      .from('atendentes')
      .insert({
        nome: nomeAtendente,
        telefone: concierge_phone?.toString() || null,
        email: concierge_email || null,
        tipo: 'concierge',
        status: 'ativo',
        horario_inicio: '09:00:00',
        horario_fim: '18:00:00',
        capacidade_maxima: 10,
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

  // 6. Criar associação com unidade (upsert para evitar duplicatas)
  const { error: associacaoError } = await supabase
    .from('atendente_unidades')
    .upsert({
      atendente_id: atendenteId,
      unidade_id: unidade_id,
      ativo: true
    }, {
      onConflict: 'atendente_id,unidade_id'
    })

  if (associacaoError) {
    console.error('Erro criando associação:', associacaoError)
    throw associacaoError
  }

  stats.associacoes++
  console.log(`✅ Associação criada: ${nomeAtendente} -> ${grupo} (${unidade_id})`)
}