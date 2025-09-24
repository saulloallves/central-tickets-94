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

    // 1. Fetch AI settings FIRST to get configured model
    const { data: aiSettings, error: settingsError } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching AI settings:', settingsError);
      throw new Error(`AI settings error: ${settingsError.message}`);
    }

    // Use default if no settings found
    const defaultSettings = {
      api_provider: 'openai',
      modelo_classificacao: 'gpt-5-2025-08-07',
      temperatura_classificacao: 0.1,
      max_tokens_classificacao: 500
    };

    const settings = aiSettings || defaultSettings;

    console.log('AI Settings loaded for classification:', {
      api_provider: settings.api_provider,
      modelo_classificacao: settings.modelo_classificacao,
      temperatura_classificacao: settings.temperatura_classificacao,
      max_tokens_classificacao: settings.max_tokens_classificacao
    });

    // Determine API endpoint and model based on provider
    let apiUrl: string;
    let apiKey: string;
    let apiHeaders: Record<string, string>;
    let model: string;

    if (settings.api_provider === 'lambda') {
      apiUrl = `${settings.api_base_url}/chat/completions`;
      apiKey = settings.api_key || Deno.env.get('LAMBDA_API_KEY')!;
      model = settings.modelo_classificacao || settings.modelo_analise || 'llama-4-maverick-17b-128e-instruct-fp8';
      
      apiHeaders = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      // Add custom headers if configured
      if (settings.custom_headers && typeof settings.custom_headers === 'object') {
        Object.assign(apiHeaders, settings.custom_headers);
      }
    } else {
      // OpenAI or other providers
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      apiKey = Deno.env.get('OPENAI_API_KEY')!;
      model = settings.modelo_classificacao || 'gpt-5-2025-08-07';
      
      apiHeaders = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
    }

    if (!apiKey) {
      throw new Error(`${settings.api_provider.toUpperCase()} API key not found`);
    }

    // Helper function to build analysis request with correct model
    const buildAnalysisRequest = (prompt: string) => {
      const isNewerOpenAIModel = model.includes('gpt-4.1') || model.includes('gpt-5') || model.includes('o3') || model.includes('o4');
      
      const requestBody: any = {
        model,
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em classificação de tickets de suporte técnico. Analise sempre em português brasileiro e seja preciso nas classificações.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      // Set parameters based on provider and model
      if (settings.api_provider === 'lambda') {
        // Lambda API supports temperature and max_tokens
        requestBody.temperature = settings.temperatura_classificacao || 0.1;
        requestBody.max_tokens = settings.max_tokens_classificacao || 500;
        requestBody.top_p = 1.0;
        requestBody.frequency_penalty = 0;
        requestBody.presence_penalty = 0;
      } else if (isNewerOpenAIModel) {
        // Newer OpenAI models use max_completion_tokens and don't support temperature
        requestBody.max_completion_tokens = settings.max_tokens_classificacao || 500;
        requestBody.frequency_penalty = 0;
        requestBody.presence_penalty = 0;
      } else {
        // Legacy OpenAI models
        requestBody.max_tokens = settings.max_tokens_classificacao || 500;
        requestBody.temperature = settings.temperatura_classificacao || 0.1;
        requestBody.top_p = 1.0;
        requestBody.frequency_penalty = 0;
        requestBody.presence_penalty = 0;
      }

      return requestBody;
    };

    // Buscar todas as equipes ativas com introdução
    const { data: equipesAtivas } = await supabase
      .from('equipes')
      .select('id, nome, introducao')
      .eq('ativo', true)
      .order('nome');

    console.log('Equipes ativas encontradas:', JSON.stringify(equipesAtivas, null, 2));

    const equipesDisponiveis = equipesAtivas?.map(e => `- ${e.nome}: ${e.introducao || 'Sem especialidades definidas'}`).join('\n') || 'Nenhuma equipe disponível';

    // Prompt para análise completa incluindo título
    const analysisPrompt = `
Você é um especialista em classificação de tickets de suporte técnico da Cresci & Perdi.

Analise este ticket e forneça:
Você é um especialista em classificação de tickets de suporte técnico da Cresci & Perdi.

Analise este ticket e forneça:

1. TÍTULO: Crie um título DESCRITIVO de exatamente 3 palavras que resuma o OBJETIVO/PROBLEMA principal.
   - NÃO copie as primeiras palavras da descrição
   - Seja criativo e descritivo
   - Exemplos: "Problema áudio Zoom", "Solicitar materiais gráficos", "Criação mídia planfetos"

2. CATEGORIA: juridico, sistema, midia, operacoes, rh, financeiro, outro

3. PRIORIDADE (OBRIGATÓRIO escolher uma): baixo, medio, alto, imediato, crise
   - baixo: dúvidas, solicitações, problemas menores
   - medio: problemas importantes mas não bloqueiam trabalho
   - alto: problemas urgentes que afetam produtividade  
   - imediato: problemas críticos que impedem funcionamento
   - crise: problemas que afetam múltiplas unidades

4. EQUIPE_SUGERIDA: Analise cuidadosamente qual equipe deve atender baseado nas ESPECIALIDADES de cada equipe:

EQUIPES E SUAS ESPECIALIDADES:
${equipesDisponiveis}

INSTRUÇÕES PARA DESIGNAÇÃO DE EQUIPE:
- Leia atentamente as ESPECIALIDADES de cada equipe listadas acima
- Escolha a equipe cuja especialidade melhor corresponde ao problema descrito
- Use o nome EXATO da equipe como aparece na lista
- Se nenhuma equipe se adequar perfeitamente, retorne null

Descrição do problema: "${descricao}"
Categoria atual: ${categoria || 'não definida'}

Responda APENAS em formato JSON válido:
{
  "titulo": "Título Descritivo Criativo",
  "categoria": "categoria_sugerida", 
  "prioridade": "baixo_ou_medio_ou_alto_ou_imediato_ou_crise",
  "equipe_sugerida": "nome_exato_da_equipe_ou_null",
  "justificativa": "Breve explicação da análise e por que escolheu esta equipe"
}

CRÍTICO: Use APENAS estas 5 prioridades: baixo, medio, alto, imediato, crise
`

    console.log('Calling AI API for ticket analysis with provider:', settings.api_provider, 'model:', model)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(buildAnalysisRequest(analysisPrompt)),
    })

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`)
    }

    const apiData = await response.json()
    const aiResponse = apiData.choices[0]?.message?.content

    console.log('AI response:', aiResponse)
    console.log('AI full response data:', JSON.stringify(apiData, null, 2))

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
      console.log('Parsed AI analysis:', analysis)
      
      // Garantir que o título tenha no máximo 3 palavras e qualidade
      if (analysis.titulo) {
        analysis.titulo = limitTitleToThreeWords(analysis.titulo);
      }
      
      // Validar e corrigir prioridade para usar apenas as 5 opções válidas
      const validPriorities = ['baixo', 'medio', 'alto', 'imediato', 'crise'];
      if (!validPriorities.includes(analysis.prioridade)) {
        console.log(`❌ INVALID PRIORITY: AI suggested "${analysis.prioridade}", mapping to valid priority`);
        // Mapear prioridades antigas para novas se necessário
        switch (analysis.prioridade) {
          case 'posso_esperar':
          case 'padrao_24h':
            analysis.prioridade = 'baixo';
            break;
          case 'ainda_hoje':
          case 'hoje_18h':
            analysis.prioridade = 'medio';
            break;
          case 'ate_1_hora':
          case 'alta':
            analysis.prioridade = 'alto';
            break;
          case 'urgente':
            analysis.prioridade = 'imediato';
            break;
          default:
            analysis.prioridade = 'baixo';
            break;
        }
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
        api_provider: settings.api_provider,
        model: model,
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