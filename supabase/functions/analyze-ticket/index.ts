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

    // Buscar todas as equipes ativas
    const { data: equipesAtivas } = await supabase
      .from('equipes')
      .select('id, nome, descricao, introducao')
      .eq('ativo', true)
      .order('nome');

    console.log('🏢 Equipes encontradas para análise:', equipesAtivas?.map(e => ({
      id: e.id,
      nome: e.nome,
      descricao: e.descricao,
      introducao: e.introducao
    })));

    const equipesDisponiveis = equipesAtivas?.map(e => 
      `- ${e.nome}: ${e.descricao}\n  Especialidades: ${e.introducao || 'Não especificado'}`
    ).join('\n') || 'Nenhuma equipe disponível';

    console.log('📋 Prompt das equipes enviado para IA:\n', equipesDisponiveis);

    // Prompt para análise completa incluindo título
    const analysisPrompt = `
Analise este ticket de suporte e forneça:

1. TÍTULO: Crie um título DESCRITIVO de exatamente 3 palavras que resuma o OBJETIVO/PROBLEMA principal. NÃO copie as primeiras palavras da descrição. Seja criativo e descritivo.
   Exemplos: 
   - "Problema áudio Zoom" (não "Preciso do áudio")
   - "Solicitar materiais gráficos" (não "Olá Gostaria de") 
   - "Criação mídia planfetos" (não "mídias para planfetos")

2. CATEGORIA: Classifique em uma das opções: juridico, sistema, midia, operacoes, rh, financeiro, outro
3. PRIORIDADE: Escolha OBRIGATORIAMENTE uma destas 4 opções: imediato, ate_1_hora, ainda_hoje, posso_esperar
   - imediato: problemas críticos que impedem funcionamento
   - ate_1_hora: problemas urgentes que afetam produtividade  
   - ainda_hoje: problemas importantes mas não bloqueiam trabalho
   - posso_esperar: dúvidas, solicitações, problemas menores
4. EQUIPE_SUGERIDA: Analise CUIDADOSAMENTE as especialidades de cada equipe e suas descrições completas. Priorize as ESPECIALIDADES (introdução) sobre apenas o nome da equipe.

Descrição do problema: "${descricao}"
Categoria atual: ${categoria || 'não definida'}

EQUIPES DISPONÍVEIS (ANALISE AS ESPECIALIDADES COM ATENÇÃO):
${equipesDisponiveis}

INSTRUÇÕES PARA ESCOLHA DA EQUIPE:
- Leia TODAS as especialidades listadas para cada equipe
- Para problemas com "eventos": considere Agência (eventos/mídias) ou Concierge Operação (eventos de treinamento)
- Para problemas de sistema/login: Sistema DFcom
- Para criação de mídias/materiais: Agência ou Mídias
- Para automação/girabot: Automação
- Para áudios/comunicação: Comunicação

ATENÇÃO: A prioridade deve ser EXATAMENTE uma destas palavras: imediato, ate_1_hora, ainda_hoje, posso_esperar
NÃO use: urgente, crítico, alta, baixa, crise, normal ou qualquer outra variação.

Responda APENAS em formato JSON válido:
{
  "titulo": "Título Descritivo Criativo",
  "categoria": "categoria_sugerida", 
  "prioridade": "imediato_ou_ate_1_hora_ou_ainda_hoje_ou_posso_esperar",
  "equipe_sugerida": "nome_exato_da_equipe_ou_null",
  "justificativa": "Breve explicação da análise focando nas especialidades da equipe escolhida"
}

CRÍTICO: Use APENAS estas 4 prioridades: imediato, ate_1_hora, ainda_hoje, posso_esperar
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
      
      // Validar e corrigir prioridade para usar apenas as 4 novas opções
      const validPriorities = ['imediato', 'ate_1_hora', 'ainda_hoje', 'posso_esperar'];
      if (!validPriorities.includes(analysis.prioridade)) {
        console.log(`❌ INVALID PRIORITY: AI suggested "${analysis.prioridade}", mapping to valid priority`);
        // Mapear prioridades antigas para novas se necessário
        switch (analysis.prioridade) {
          case 'urgente':
          case 'crise':
            analysis.prioridade = 'imediato';
            break;
          case 'alta':
            analysis.prioridade = 'ate_1_hora';
            break;
          case 'hoje_18h':
            analysis.prioridade = 'ainda_hoje';
            break;
          case 'padrao_24h':
          default:
            analysis.prioridade = 'posso_esperar';
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