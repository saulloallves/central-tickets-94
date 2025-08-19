
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { ticketId, descricao, categoria } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not found')
    }

    // Prompt para análise completa incluindo título
    const analysisPrompt = `
Analise este ticket de suporte e forneça:

1. TÍTULO: Um título claro e descritivo de 5-10 palavras que resuma o problema
2. CATEGORIA: Classifique em uma das opções: juridico, sistema, midia, operacoes, rh, financeiro, outro
3. PRIORIDADE: Determine se é: crise, urgente, alta, hoje_18h, padrao_24h
4. EQUIPE_SUGERIDA: Sugira qual equipe deve atender baseado no problema

Descrição do problema: "${descricao}"
Categoria atual: ${categoria || 'não definida'}

Responda APENAS em formato JSON válido:
{
  "titulo": "Título do problema",
  "categoria": "categoria_sugerida", 
  "prioridade": "prioridade_sugerida",
  "equipe_sugerida": "nome_da_equipe_ou_null",
  "justificativa": "Breve explicação da análise"
}
`

    console.log('Calling OpenAI for ticket analysis...')
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em classificação de tickets de suporte técnico. Analise sempre em português brasileiro e seja preciso nas classificações.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const openaiData = await response.json()
    const aiResponse = openaiData.choices[0]?.message?.content

    console.log('OpenAI response:', aiResponse)

    let analysis = null
    try {
      analysis = JSON.parse(aiResponse)
    } catch (error) {
      console.error('Error parsing AI response:', error)
      // Fallback com título baseado na descrição
      analysis = {
        titulo: descricao.length > 50 ? descricao.substring(0, 50) + '...' : descricao,
        categoria: categoria || 'outro',
        prioridade: 'padrao_24h',
        equipe_sugerida: null,
        justificativa: 'Análise automática com fallback'
      }
    }

    // Buscar equipe por nome se foi sugerida
    let equipeId = null
    if (analysis.equipe_sugerida) {
      const { data: equipe } = await supabase
        .from('equipes')
        .select('id')
        .ilike('nome', `%${analysis.equipe_sugerida}%`)
        .eq('ativo', true)
        .single()
      
      if (equipe) {
        equipeId = equipe.id
      }
    }

    // Atualizar o ticket com os resultados da análise
    const updateData: any = {
      titulo: analysis.titulo,
      log_ia: {
        analysis_timestamp: new Date().toISOString(),
        ai_response: aiResponse,
        model: 'gpt-4o-mini',
        categoria_sugerida: analysis.categoria,
        prioridade_sugerida: analysis.prioridade,
        equipe_sugerida: analysis.equipe_sugerida,
        justificativa: analysis.justificativa
      }
    }

    // Adicionar equipe se foi encontrada
    if (equipeId) {
      updateData.equipe_responsavel_id = equipeId
    }

    const { error: updateError } = await supabase
      .from('tickets')
      .update(updateData)
      .eq('id', ticketId)

    if (updateError) {
      console.error('Error updating ticket:', updateError)
      throw updateError
    }

    console.log(`Ticket ${ticketId} analyzed and updated successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysis,
        equipe_id: equipeId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in analyze-ticket:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
