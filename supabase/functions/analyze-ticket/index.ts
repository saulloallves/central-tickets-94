
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

    // Buscar todas as equipes ativas
    const { data: equipesAtivas } = await supabase
      .from('equipes')
      .select('id, nome, descricao')
      .eq('ativo', true)
      .order('nome');

    const equipesDisponiveis = equipesAtivas?.map(e => `- ${e.nome}: ${e.descricao}`).join('\n') || 'Nenhuma equipe disponível';

    // Prompt para análise completa incluindo título
    const analysisPrompt = `
Analise este ticket de suporte e forneça:

1. TÍTULO: Crie um título DESCRITIVO de exatamente 3 palavras que resuma o OBJETIVO/PROBLEMA principal. NÃO copie as primeiras palavras da descrição. Seja criativo e descritivo.
   Exemplos: 
   - "Problema áudio Zoom" (não "Preciso do áudio")
   - "Solicitar materiais gráficos" (não "Olá Gostaria de") 
   - "Criação mídia planfetos" (não "mídias para planfetos")

2. CATEGORIA: Classifique em uma das opções: juridico, sistema, midia, operacoes, rh, financeiro, outro
3. PRIORIDADE: Determine se é: imediato (15min), ate_1_hora (1h), ainda_hoje (até 18h), posso_esperar (24h)
4. EQUIPE_SUGERIDA: Sugira qual equipe deve atender baseado no problema e nas equipes disponíveis

Descrição do problema: "${descricao}"
Categoria atual: ${categoria || 'não definida'}

EQUIPES DISPONÍVEIS:
${equipesDisponiveis}

Responda APENAS em formato JSON válido:
{
  "titulo": "Título Descritivo Criativo",
  "categoria": "categoria_sugerida", 
  "prioridade": "prioridade_sugerida",
  "equipe_sugerida": "nome_exato_da_equipe_ou_null",
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

    // Função para garantir máximo 3 palavras no título e melhorar qualidade
    const limitTitleToThreeWords = (title: string): string => {
      if (!title) return 'Problema Técnico';
      // Remove pontuação desnecessária e limita a 3 palavras
      const cleanTitle = title.trim().replace(/[.,!?;:"']+/g, '');
      const words = cleanTitle.split(/\s+/).filter(word => word.length > 0);
      return words.slice(0, 3).join(' ');
    };

    const generateFallbackTitle = (description: string): string => {
      // Criar título mais inteligente baseado na descrição
      const desc = description.toLowerCase();
      if (desc.includes('áudio') || desc.includes('audio') || desc.includes('som')) return 'Problema Áudio';
      if (desc.includes('planfeto') || desc.includes('panfleto') || desc.includes('mídia')) return 'Criação Mídia';
      if (desc.includes('solicitar') || desc.includes('preciso') || desc.includes('gostaria')) return 'Solicitação Material';
      if (desc.includes('sistema') || desc.includes('erro') || desc.includes('bug')) return 'Erro Sistema';
      if (desc.includes('jurídico') || desc.includes('juridico') || desc.includes('contrato')) return 'Questão Jurídica';
      
      // Fallback: pegar palavras importantes
      const words = description.trim().split(/\s+/).filter(word => 
        word.length > 3 && 
        !['preciso', 'gostaria', 'solicitar', 'favor', 'olá', 'ola'].includes(word.toLowerCase())
      );
      return words.slice(0, 3).join(' ') || 'Novo Ticket';
    };

    let analysis = null
    try {
      analysis = JSON.parse(aiResponse)
      // Garantir que o título tenha no máximo 3 palavras e qualidade
      if (analysis.titulo) {
        analysis.titulo = limitTitleToThreeWords(analysis.titulo);
      }
    } catch (error) {
      console.error('Error parsing AI response:', error)
      // Fallback com título inteligente baseado na descrição
      const fallbackTitle = generateFallbackTitle(descricao);
      analysis = {
        titulo: fallbackTitle,
        categoria: categoria || 'outro',
        prioridade: 'posso_esperar',
        equipe_sugerida: null,
        justificativa: 'Análise automática com fallback'
      }
    }

    // Buscar equipe por nome exato se foi sugerida
    let equipeId = null
    if (analysis.equipe_sugerida) {
      console.log('Procurando equipe:', analysis.equipe_sugerida);
      
      // Primeiro, tentar match exato
      let { data: equipe } = await supabase
        .from('equipes')
        .select('id, nome')
        .eq('nome', analysis.equipe_sugerida)
        .eq('ativo', true)
        .single()
      
      // Se não encontrar match exato, tentar busca similar
      if (!equipe) {
        const { data: equipeSimilar } = await supabase
          .from('equipes')
          .select('id, nome')
          .ilike('nome', `%${analysis.equipe_sugerida}%`)
          .eq('ativo', true)
          .single()
        
        equipe = equipeSimilar;
      }
      
      if (equipe) {
        equipeId = equipe.id;
        console.log(`Equipe encontrada: ${equipe.nome} (ID: ${equipe.id})`);
      } else {
        console.log('Nenhuma equipe encontrada para:', analysis.equipe_sugerida);
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
