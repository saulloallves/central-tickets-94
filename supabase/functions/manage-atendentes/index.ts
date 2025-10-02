import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

interface AtendenteData {
  nome: string
  telefone?: string
  email?: string
  tipo: 'concierge' | 'dfcom'
  status?: 'ativo' | 'pausa' | 'almoco' | 'indisponivel' | 'inativo'
  horario_inicio?: string
  horario_fim?: string
  capacidade_maxima?: number
  foto_perfil?: string
  observacoes?: string
  ativo?: boolean
  user_id?: string
  unidades?: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { action, id, data } = await req.json()
    console.log(`🔧 Manage Atendentes - Action: ${action}`)

    switch (action) {
      case 'list':
        return await listAtendentes()
      case 'list_external':
        return await listExternalAtendentes()
      case 'get':
        return await getAtendente(id)
      case 'create':
        return await createAtendente(data)
      case 'update':
        return await updateAtendente(id, data)
      case 'delete':
        return await deleteAtendente(id)
      case 'update_status':
        return await updateStatus(id, data.status)
      case 'get_capacity':
        return await getCapacity(data.tipo, data.unidade_id)
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

async function listAtendentes() {
  try {
    // First get all atendentes with linked user data
    const { data: atendentes, error: atendentesError } = await supabase
      .from('atendentes')
      .select(`
        *,
        user:user_id (
          id,
          nome_completo,
          email
        )
      `)
      .eq('ativo', true)
      .order('tipo', { ascending: true })
      .order('nome', { ascending: true })

    if (atendentesError) {
      console.error('Error fetching atendentes:', atendentesError)
      throw atendentesError
    }

    // If no atendentes found, return empty array
    if (!atendentes || atendentes.length === 0) {
      console.log('No atendentes found')
      return new Response(
        JSON.stringify({ data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to get all atendente_unidades associations at once
    try {
      const atendenteIds = atendentes.map(a => a.id)
      const { data: allUnidades, error: unidadesError } = await supabase
        .from('atendente_unidades')
        .select('id, atendente_id, prioridade, ativo, codigo_grupo, grupo')
        .in('atendente_id', atendenteIds)
        .eq('ativo', true)

      if (unidadesError) {
        console.error('Error fetching atendente_unidades:', unidadesError)
        // Continue without associations if there's an error
      }

      // Map associations to atendentes
      for (const atendente of atendentes) {
        atendente.atendente_unidades = allUnidades 
          ? allUnidades.filter(u => u.atendente_id === atendente.id)
          : []
      }
    } catch (error) {
      console.error('Error processing atendente_unidades:', error)
      // Continue without associations if there's an error
      for (const atendente of atendentes) {
        atendente.atendente_unidades = []
      }
    }

    console.log(`✅ Found ${atendentes.length} atendentes`)
    return new Response(
      JSON.stringify({ data: atendentes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error in listAtendentes:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function getAtendente(id: string) {
  const { data: atendente, error: atendenteError } = await supabase
    .from('atendentes')
    .select(`
      *,
      user:user_id (
        id,
        nome_completo,
        email
      )
    `)
    .eq('id', id)
    .single()

  if (atendenteError) throw atendenteError

  // Buscar associações separadamente
  const { data: unidades } = await supabase
    .from('atendente_unidades')
    .select('id, prioridade, ativo, codigo_grupo, grupo')
    .eq('atendente_id', id)
    .eq('ativo', true)
  
  atendente.atendente_unidades = unidades || []

  return new Response(
    JSON.stringify({ data: atendente }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function createAtendente(data: AtendenteData) {
  const { unidades, ...atendenteData } = data

  // Validar se user_id existe e é único
  if (atendenteData.user_id) {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', atendenteData.user_id)
      .single()

    if (!existingUser) {
      throw new Error('Usuário não encontrado')
    }

    const { data: existingAtendente } = await supabase
      .from('atendentes')
      .select('id')
      .eq('user_id', atendenteData.user_id)
      .eq('ativo', true)
      .single()

    if (existingAtendente) {
      throw new Error('Este usuário já está vinculado a outro atendente')
    }
  }

  // 1. Criar atendente
  const { data: atendente, error: atendenteError } = await supabase
    .from('atendentes')
    .insert(atendenteData)
    .select(`
      *,
      user:user_id (
        id,
        nome_completo,
        email
      )
    `)
    .single()

  if (atendenteError) throw atendenteError

  // 2. Associar com unidades se fornecidas
  if (unidades && unidades.length > 0) {
    const unidadeAssociations = unidades.map((unidade_id, index) => ({
      id: unidade_id,
      atendente_id: atendente.id,
      prioridade: index + 1
    }))

    const { error: unidadeError } = await supabase
      .from('atendente_unidades')
      .insert(unidadeAssociations)

    if (unidadeError) throw unidadeError
  }

  console.log(`✅ Atendente criado: ${atendente.nome} (${atendente.tipo})`)
  
  return new Response(
    JSON.stringify({ data: atendente }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function updateAtendente(id: string, data: Partial<AtendenteData>) {
  const { unidades, ...atendenteData } = data

  // Validar se user_id existe e é único (se estiver sendo alterado)
  if (atendenteData.user_id) {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', atendenteData.user_id)
      .single()

    if (!existingUser) {
      throw new Error('Usuário não encontrado')
    }

    const { data: existingAtendente } = await supabase
      .from('atendentes')
      .select('id')
      .eq('user_id', atendenteData.user_id)
      .eq('ativo', true)
      .neq('id', id)
      .single()

    if (existingAtendente) {
      throw new Error('Este usuário já está vinculado a outro atendente')
    }
  }

  // 1. Atualizar dados do atendente
  const { data: atendente, error: atendenteError } = await supabase
    .from('atendentes')
    .update(atendenteData)
    .eq('id', id)
    .select(`
      *,
      user:user_id (
        id,
        nome_completo,
        email
      )
    `)
    .single()

  if (atendenteError) throw atendenteError

  // 2. Atualizar associações com unidades se fornecidas
  if (unidades !== undefined) {
    // Remover associações antigas
    await supabase
      .from('atendente_unidades')
      .delete()
      .eq('atendente_id', id)

    // Criar novas associações
    if (unidades.length > 0) {
      const unidadeAssociations = unidades.map((unidade_id, index) => ({
        id: unidade_id,
        atendente_id: id,
        prioridade: index + 1
      }))

      const { error: unidadeError } = await supabase
        .from('atendente_unidades')
        .insert(unidadeAssociations)

      if (unidadeError) throw unidadeError
    }
  }

  console.log(`✅ Atendente atualizado: ${atendente.nome}`)
  
  return new Response(
    JSON.stringify({ data: atendente }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function deleteAtendente(id: string) {
  // Soft delete - marca como inativo
  const { data, error } = await supabase
    .from('atendentes')
    .update({ ativo: false, status: 'inativo' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  console.log(`✅ Atendente removido: ${data.nome}`)
  
  return new Response(
    JSON.stringify({ data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function listExternalAtendentes() {
  try {
    console.log('🔍 Buscando dados da tabela externa unidades...')
    
    // Buscar todas as unidades da tabela externa
    const { data: unidades, error: unidadesError } = await supabase
      .from('unidades')
      .select('id, grupo, codigo_grupo, telefone, email')
      .limit(100)

    if (unidadesError) {
      console.error('Error fetching unidades:', unidadesError)
      throw unidadesError
    }

    if (!unidades || unidades.length === 0) {
      console.log('⚠️ Nenhuma unidade encontrada na tabela externa')
      return new Response(
        JSON.stringify({ data: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Converter dados das unidades em formato de atendentes
    const atendentesExternos = unidades.map((unidade, index) => ({
      id: `external_${unidade.id}`,
      nome: `Atendente ${unidade.grupo || unidade.id}`,
      telefone: unidade.telefone?.toString(),
      email: unidade.email,
      tipo: 'concierge',
      status: 'ativo',
      horario_inicio: '08:00:00',
      horario_fim: '18:00:00', 
      capacidade_maxima: 5,
      capacidade_atual: 0,
      foto_perfil: null,
      observacoes: `Unidade externa: ${unidade.grupo}`,
      ativo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      atendente_unidades: [{
        id: unidade.id,
        prioridade: 1,
        ativo: true
      }]
    }))

    console.log(`✅ Convertidas ${atendentesExternos.length} unidades em atendentes`)
    
    return new Response(
      JSON.stringify({ data: atendentesExternos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error in listExternalAtendentes:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function updateStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('atendentes')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  console.log(`✅ Status atualizado: ${data.nome} -> ${status}`)
  
  return new Response(
    JSON.stringify({ data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getCapacity(tipo: string, unidade_id: string) {
  const { data, error } = await supabase
    .rpc('get_available_capacity', { 
      p_tipo: tipo,
      p_unidade_id: unidade_id 
    })

  if (error) throw error

  return new Response(
    JSON.stringify({ capacity: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}