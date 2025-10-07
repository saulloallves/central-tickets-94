import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🚀 Iniciando importação de atendentes da API externa...')

    // 1. Buscar dados da API externa
    const externalApiUrl = Deno.env.get('EXTERNAL_API_URL')
    const externalApiKey = Deno.env.get('EXTERNAL_API_KEY')
    
    if (!externalApiUrl || !externalApiKey) {
      throw new Error('URL ou chave da API externa não configuradas')
    }

    console.log('🌐 Buscando dados da API externa...')
    console.log(`🔗 URL: ${externalApiUrl}`)
    
    // Construir URL completa para a tabela unidades
    const fullUrl = externalApiUrl.endsWith('/') 
      ? `${externalApiUrl}rest/v1/unidades`
      : `${externalApiUrl}/rest/v1/unidades`;
    
    console.log(`🔗 URL completa: ${fullUrl}`)
    
    const externalResponse = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'apikey': externalApiKey,
        'Authorization': `Bearer ${externalApiKey}`,
        'Content-Type': 'application/json'
      }
    })

    console.log(`📊 Status da resposta: ${externalResponse.status}`)
    
    if (!externalResponse.ok) {
      const errorText = await externalResponse.text()
      console.log(`❌ Erro na API externa: ${errorText}`)
      throw new Error(`Erro na API externa: ${externalResponse.status} - ${externalResponse.statusText}. Resposta: ${errorText}`)
    }

    const externalData = await externalResponse.json()
    console.log(`📊 Recebidos ${Array.isArray(externalData) ? externalData.length : 'dados'} registros da API externa`)

    // 2. Validar estrutura dos dados
    if (!Array.isArray(externalData) || externalData.length === 0) {
      console.log('⚠️ Nenhum dado válido recebido da API externa')
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Nenhum dado válido recebido da API externa',
          stats: { total: 0, processadas: 0, criados: 0, atualizados: 0, associacoes: 0, sem_concierge: 0, erros: [] }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Filtrar registros que têm dados de concierge
    const unidadesComConcierge = externalData.filter(record => 
      record.concierge_name && 
      (record.concierge_phone || record.concierge_email) &&
      (record.id || record.codigo_grupo)
    )

    console.log(`🎯 Encontradas ${unidadesComConcierge.length} unidades com dados de concierge válidos`)

    const stats = {
      total: unidadesComConcierge.length,
      processadas: 0,
      criados: 0,
      atualizados: 0,
      associacoes: 0,
      sem_concierge: 0,
      duplicatas_telefone: 0,
      duplicatas_email: 0,
      erros: []
    }

    // 4. Processar cada registro da API externa
    for (const record of unidadesComConcierge) {
      try {
        await processarRegistroExterno(record, stats, supabase)
        stats.processadas++
      } catch (error) {
        console.error(`❌ Erro processando registro ${record.id || record.codigo_grupo}:`, error)
        stats.erros.push({
          registro_id: record.id || record.codigo_grupo,
          grupo: record.grupo || record.cidade,
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

async function processarRegistroExterno(record: any, stats: any, supabase: any) {
  // 1. Extrair dados do registro da API externa (id é UUID)
  const unidade_id = record.id || record.codigo_grupo?.toString() // UUID or codigo_grupo
  const unidade_id_externo = record.id?.toString() // Guardar ID original da API externa
  const { grupo, codigo_grupo, cidade, uf, concierge_name, concierge_phone, concierge_email, id_grupo_branco } = record
  
  console.log(`🔍 Processando unidade ${grupo || cidade} (ID: ${unidade_id})`)
  
  if (!concierge_name) {
    console.log(`⚠️ Registro ${unidade_id} sem nome do concierge - pulando`)
    stats.sem_concierge++
    return
  }
  
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

  // 6. Verificar se unidade existe no sistema local
  const { data: unidadeLocal, error: unidadeError } = await supabase
    .from('unidades')
    .select('id')
    .or(`id.eq.${unidade_id},codigo_grupo.eq.${codigo_grupo || unidade_id}`)
    .maybeSingle()

  if (unidadeError) {
    console.error('Erro verificando unidade local:', unidadeError)
    throw unidadeError
  }

  if (!unidadeLocal) {
    console.log(`⚠️ Unidade ${unidade_id} não encontrada no sistema local - criando associação com ID da API`)
  }

  const unidadeIdFinal = unidadeLocal?.id || unidade_id

  // 7. Criar associação na tabela atendente_unidades (upsert para evitar duplicatas)
  const { error: associacaoError } = await supabase
    .from('atendente_unidades')
    .upsert({
      atendente_id: atendenteId,
      codigo_grupo: codigo_grupo?.toString(),
      grupo: grupo || cidade,
      id_grupo_branco: id_grupo_branco,
      concierge_name: concierge_name,
      concierge_phone: concierge_phone,
      unidade_id_externo: unidade_id_externo,
      ativo: true,
      prioridade: 1
    }, {
      onConflict: 'atendente_id,codigo_grupo'
    })

  if (associacaoError) {
    console.error('Erro criando associação:', associacaoError)
    throw associacaoError
  }

  stats.associacoes++
  console.log(`✅ Associação criada: ${nomeAtendente} -> ${grupo || cidade} (${unidadeIdFinal})`)
}