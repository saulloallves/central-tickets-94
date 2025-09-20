import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  group_phone: string
  ticket_id: string
  action: 'start' | 'stop'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request body
    const { group_phone, ticket_id, action }: RequestBody = await req.json()

    console.log(`🎯 Setting ticket response mode for group: ${group_phone}, action: ${action}`)

    if (action === 'start') {
      // Configurar grupo para aguardar resposta ao ticket
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutos

      const { data, error } = await supabase
        .from('whatsapp_group_states')
        .upsert({
          group_phone,
          awaiting_ticket_response: true,
          ticket_id,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'group_phone'
        })
        .select()

      if (error) {
        console.error('❌ Erro ao configurar estado do grupo:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao configurar estado do grupo' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log(`✅ Grupo configurado para aguardar resposta ao ticket ${ticket_id} até ${expiresAt.toISOString()}`)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Grupo configurado para aguardar resposta ao ticket',
          data: data?.[0],
          expires_at: expiresAt.toISOString()
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )

    } else if (action === 'stop') {
      // Parar de aguardar resposta ao ticket
      const { data, error } = await supabase
        .from('whatsapp_group_states')
        .upsert({
          group_phone,
          awaiting_ticket_response: false,
          ticket_id: null,
          expires_at: null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'group_phone'
        })
        .select()

      if (error) {
        console.error('❌ Erro ao parar modo de resposta:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao parar modo de resposta' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log(`✅ Modo de resposta ao ticket parado para grupo ${group_phone}`)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Modo de resposta ao ticket parado',
          data: data?.[0]
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida. Use "start" ou "stop"' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})