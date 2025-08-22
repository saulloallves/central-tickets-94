import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar crises ativas órfãs
    const { data: orphanedCrises, error: searchError } = await supabaseClient
      .from('crises_ativas')
      .select(`
        id,
        ticket_id,
        tickets:ticket_id (
          id,
          prioridade,
          status
        )
      `)
      .is('resolvida_em', null)

    if (searchError) {
      console.error('Erro ao buscar crises ativas:', searchError)
      throw searchError
    }

    console.log(`Encontradas ${orphanedCrises?.length || 0} crises ativas`)

    // Filtrar crises que devem ser resolvidas (ticket não está mais em crise)
    const crisesToResolve = orphanedCrises?.filter(crise => {
      const ticket = crise.tickets
      return !ticket || 
             ticket.prioridade !== 'crise' || 
             !['aberto', 'em_atendimento', 'escalonado'].includes(ticket.status)
    }) || []

    console.log(`${crisesToResolve.length} crises serão resolvidas automaticamente`)

    let resolvedCount = 0

    // Resolver cada crise órfã
    for (const crise of crisesToResolve) {
      const { error: updateError } = await supabaseClient
        .from('crises_ativas')
        .update({
          resolvida_em: new Date().toISOString(),
          resolvida_por: null,
          log_acoes: [
            ...(crise.log_acoes || []),
            {
              acao: 'auto_resolver',
              por: null,
              em: new Date().toISOString(),
              motivo: 'Crise resolvida automaticamente - ticket não está mais em status de crise'
            }
          ]
        })
        .eq('id', crise.id)

      if (updateError) {
        console.error(`Erro ao resolver crise ${crise.id}:`, updateError)
      } else {
        resolvedCount++
        console.log(`Crise ${crise.id} resolvida automaticamente`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Limpeza concluída: ${resolvedCount} crises órfãs foram resolvidas`,
        resolved_count: resolvedCount,
        total_checked: orphanedCrises?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Erro na limpeza de crises:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})