import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import { corsHeaders } from '../_shared/cors.ts'

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
  const { data, error } = await supabase
    .from('atendentes')
    .select(`
      *,
      atendente_unidades:atendente_unidades!atendente_id(
        unidade_id,
        is_preferencial,
        prioridade,
        ativo
      )
    `)
    .eq('ativo', true)
    .order('tipo', { ascending: true })
    .order('nome', { ascending: true })

  if (error) throw error

  return new Response(
    JSON.stringify({ data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getAtendente(id: string) {
  const { data, error } = await supabase
    .from('atendentes')
    .select(`
      *,
      atendente_unidades:atendente_unidades!atendente_id(
        unidade_id,
        is_preferencial,
        prioridade,
        ativo
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  return new Response(
    JSON.stringify({ data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function createAtendente(data: AtendenteData) {
  const { unidades, ...atendenteData } = data

  // 1. Criar atendente
  const { data: atendente, error: atendenteError } = await supabase
    .from('atendentes')
    .insert(atendenteData)
    .select()
    .single()

  if (atendenteError) throw atendenteError

  // 2. Associar com unidades se fornecidas
  if (unidades && unidades.length > 0) {
    const unidadeAssociations = unidades.map((unidade_id, index) => ({
      atendente_id: atendente.id,
      unidade_id,
      is_preferencial: index === 0, // Primeira unidade é preferencial
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

  // 1. Atualizar dados do atendente
  const { data: atendente, error: atendenteError } = await supabase
    .from('atendentes')
    .update(atendenteData)
    .eq('id', id)
    .select()
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
        atendente_id: id,
        unidade_id,
        is_preferencial: index === 0,
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