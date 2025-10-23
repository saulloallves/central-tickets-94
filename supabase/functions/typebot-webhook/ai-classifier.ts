// @ts-nocheck
/**
 * AI-powered ticket classification engine
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { openAI } from './openai-client.ts';
import { getAdvancedSettings, buildAdvancedPrompt } from '../_shared/advanced-classifier.ts';
// import { wrapAIFunction } from '../_shared/ai-alert-utils.ts';

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

// ID da equipe Concierge Operação - usada como fallback quando a IA não tem certeza
const CONCIERGE_OPERACAO_ID = '2c080fb5-51e6-47dd-a59e-13c3d73bd8b2';

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface ClassificationResult {
  categoria?: string;
  prioridade: string;
  titulo: string;
  equipe_responsavel: string | null;
  justificativa: string;
}

export async function classifyTeamOnly(message: string, equipes: any[], existingData: Partial<ClassificationResult> = {}): Promise<{ equipe_responsavel: string | null; justificativa: string; } | null> {
  if (!openaiApiKey || !equipes || equipes.length === 0) {
    return null;
  }

  try {
    console.log('Iniciando análise IA apenas para equipe...');
    
    const supabase = getSupabaseClient();
    const { data: aiSettings } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .maybeSingle();

    const modelToUse = aiSettings?.modelo_classificacao || 'gpt-4o-mini';
    
    const equipesInfo = equipes.map(e => 
      `- ${e.nome}: ${e.descricao || 'Sem descrição'} (Introdução: ${e.introducao || 'N/A'})`
    ).join('\n');

    const existingInfo = Object.keys(existingData).length > 0 ? 
      `\nDados já definidos: ${JSON.stringify(existingData, null, 2)}` : '';

    const prompt = `Você é um especialista em classificação de tickets de suporte.

Analise a descrição do problema e determine APENAS qual equipe é mais adequada para resolver este ticket.

Descrição do problema: "${message}"${existingInfo}

Equipes disponíveis:
${equipesInfo}

IMPORTANTE: Se você NÃO TIVER CERTEZA sobre qual equipe escolher, ou se o problema não se encaixar claramente em nenhuma equipe específica, escolha "Concierge Operação". Esta equipe está preparada para analisar e redirecionar tickets incertos.

Responda APENAS com um JSON válido no formato:
{
  "equipe_responsavel": "nome_da_equipe_escolhida",
  "justificativa": "explicação de 1-2 frases do porquê desta equipe",
  "confianca": "alta, media ou baixa"
}

Escolha a equipe que melhor se adequa ao problema descrito. Use "Concierge Operação" quando em dúvida.`;

    const response = await openAI('chat/completions', {
      model: modelToUse,
      messages: [
        { role: 'system', content: 'Você é um especialista em classificação de tickets. Responda apenas com JSON válido.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 300,
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    const result = JSON.parse(content.trim());
    
    // Se a IA não retornou equipe ou está com baixa confiança, usar Concierge Operação
    if (!result.equipe_responsavel || result.confianca === 'baixa') {
      console.log('IA incerta ou sem equipe - direcionando para Concierge Operação');
      return {
        equipe_responsavel: 'Concierge Operação',
        justificativa: result.justificativa || 'Ticket requer análise adicional para direcionamento correto'
      };
    }

    console.log('Resultado da classificação de equipe:', result);
    return result;

  } catch (error) {
    console.error('Erro na classificação de equipe por IA:', error);
    // Em caso de erro, retornar Concierge Operação como fallback
    console.log('Erro na classificação - direcionando para Concierge Operação');
    return {
      equipe_responsavel: 'Concierge Operação',
      justificativa: 'Erro na classificação automática - requer análise manual'
    };
  }
}

export async function classifyTicket(message: string, equipes: any[]): Promise<ClassificationResult | null> {
  if (!openaiApiKey || !equipes || equipes.length === 0) {
    return null;
  }

  try {
    console.log('Iniciando análise IA completa...');
    
    const supabase = getSupabaseClient();
    const { data: aiSettings } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .maybeSingle();

    const modelToUse = aiSettings?.modelo_classificacao || 'gpt-4o-mini';
    const apiProvider = aiSettings?.api_provider || 'openai';
    
    let apiUrl = 'https://api.openai.com/v1/chat/completions';
    let authToken = openaiApiKey;
    let apiHeaders = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
    
    if (apiProvider === 'lambda' && aiSettings?.api_base_url) {
      apiUrl = `${aiSettings.api_base_url}/chat/completions`;
      authToken = aiSettings.api_key || openaiApiKey;
      apiHeaders.Authorization = `Bearer ${authToken}`;
      
      if (aiSettings.custom_headers && typeof aiSettings.custom_headers === 'object') {
        Object.assign(apiHeaders, aiSettings.custom_headers);
      }
    }

    // Load advanced classifier settings
    const advancedSettings = await getAdvancedSettings(supabase);

    // Build prompt using advanced settings or fallback to default
    let analysisPrompt: string;
    
    if (advancedSettings) {
      console.log('✅ Using advanced classifier prompt with ITIL matrix');
      analysisPrompt = buildAdvancedPrompt(message, advancedSettings, equipes);
    } else {
      console.log('⚠️ No advanced settings - using default prompt');
      const equipesDisponiveis = equipes?.map(e => `- ID: ${e.id} | Nome: ${e.nome}\n  Especialidade: ${e.introducao || 'Sem especialidades definidas'}`).join('\n\n') || 'Nenhuma equipe disponível';

      analysisPrompt = `
Você é um especialista em classificação de tickets de suporte técnico da Cresci & Perdi.

Analise este ticket e forneça:

1. TÍTULO: Crie um título DESCRITIVO de exatamente 3 palavras que resuma o OBJETIVO/PROBLEMA principal.
   - NÃO copie as primeiras palavras da descrição
   - Seja criativo e descritivo
   - Exemplos: "Problema áudio Zoom", "Solicitar materiais gráficos", "Criação mídia planfetos"

2. PRIORIDADE (OBRIGATÓRIO escolher uma): baixo, medio, alto, imediato, crise
   - baixo: dúvidas, solicitações, problemas menores
   - medio: problemas importantes mas não bloqueiam trabalho
   - alto: problemas urgentes que afetam produtividade  
   - imediato: problemas críticos que impedem funcionamento
   - crise: problemas que afetam múltiplas unidades

3. EQUIPE SUGERIDA: Escolha a melhor equipe baseado nas especialidades abaixo.
   IMPORTANTE: Você DEVE retornar o ID (UUID) da equipe, NÃO o nome.

Equipes disponíveis:

${equipesDisponiveis}

CRÍTICO: 
- Retorne o ID completo (UUID) da equipe no campo "equipe_sugerida"
- Se NÃO tiver certeza, use o ID: ${CONCIERGE_OPERACAO_ID} (Concierge Operação)

ANÁLISE: "${message}"

Responda APENAS em JSON válido:
{
  "prioridade": "uma_das_5_prioridades_definidas",
  "titulo": "Título de 3 palavras descritivo",
  "equipe_sugerida": "UUID_da_equipe_escolhida",
  "justificativa": "Breve explicação da análise e por que escolheu esta equipe",
  "confianca": "alta, media ou baixa"
}

EXEMPLO DE RESPOSTA CORRETA:
{
  "prioridade": "baixo",
  "titulo": "Aluguel Fantasia Disponibilidade",
  "equipe_sugerida": "36562741-7c74-4d77-8940-d598e8699342",
  "justificativa": "Solicitação de aluguel de material operacional - equipe Suprimentos",
  "confianca": "alta"
}

REGRAS CRÍTICAS:
- Use APENAS estas 5 prioridades: baixo, medio, alto, imediato, crise
- Retorne SEMPRE o UUID completo da equipe, nunca o nome
- Use ${CONCIERGE_OPERACAO_ID} quando tiver dúvida
`;
    }

    const requestBody = {
      model: modelToUse,
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em classificação de tickets de suporte técnico. Analise sempre em português brasileiro e seja preciso nas classificações.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ]
    };

    if (apiProvider === 'lambda') {
      requestBody.temperature = aiSettings?.temperatura_classificacao || 0.1;
      requestBody.max_tokens = aiSettings?.max_tokens_classificacao || 500;
      requestBody.top_p = 1.0;
      requestBody.frequency_penalty = 0;
      requestBody.presence_penalty = 0;
    } else {
      requestBody.max_tokens = aiSettings?.max_tokens_classificacao || 500;
      requestBody.temperature = aiSettings?.temperatura_classificacao || 0.1;
      requestBody.top_p = 1.0;
      requestBody.frequency_penalty = 0;
      requestBody.presence_penalty = 0;
    }

    console.log('Calling AI API with provider:', apiProvider, 'model:', modelToUse);
    
    const response = (apiProvider === 'openai')
      ? await openAI('chat/completions', requestBody)
      : await fetch(apiUrl, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify(requestBody),
        });

    if (response.ok) {
      const aiResponse = await response.json();
      const analysis = aiResponse.choices?.[0]?.message?.content;
      
      console.log('AI response:', analysis);
      
      if (analysis) {
        try {
          let cleanedAnalysis = analysis.trim();
          if (analysis.includes('```json')) {
            cleanedAnalysis = analysis.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
          } else if (analysis.includes('```')) {
            cleanedAnalysis = analysis.replace(/```\s*/g, '').trim();
          }
          
          const aiResult = JSON.parse(cleanedAnalysis);
          console.log('IA retornou:', aiResult);
          
          // Validar e corrigir prioridade
          const validPriorities = ['baixo', 'medio', 'alto', 'imediato', 'crise'];
          if (!validPriorities.includes(aiResult.prioridade)) {
            console.log(`❌ INVALID PRIORITY: AI suggested "${aiResult.prioridade}", mapping to valid priority`);
            switch (aiResult.prioridade) {
              case 'posso_esperar':
              case 'padrao_24h':
                aiResult.prioridade = 'baixo';
                break;
              case 'ainda_hoje':
              case 'hoje_18h':
                aiResult.prioridade = 'medio';
                break;
              case 'ate_1_hora':
              case 'alta':
                aiResult.prioridade = 'alto';
                break;
              case 'imediato':
                aiResult.prioridade = 'imediato';
                break;
              default:
                console.warn(`⚠️ Unknown priority "${aiResult.prioridade}", defaulting to "baixo"`);
                aiResult.prioridade = 'baixo';
            }
            console.log(`✅ Normalized AI priority to: "${aiResult.prioridade}"`);
          }

          // Garantir que o título tenha no máximo 3 palavras
          let titulo = 'Novo Ticket';
          if (aiResult.titulo) {
            const cleanTitle = aiResult.titulo.trim().replace(/[.,!?;:"']+/g, '');
            const words = cleanTitle.split(/\s+/).filter(word => word.length > 0);
            titulo = words.slice(0, 3).join(' ');
          }
          
          // Se a IA não sugeriu equipe ou está com baixa confiança, usar Concierge Operação
          let equipeId = aiResult.equipe_sugerida;
          
          // Debug: log de todas as equipes disponíveis
          console.log('🔍 Equipes disponíveis:', equipes.map(e => ({ id: e.id, nome: e.nome })));
          console.log('🔍 ID sugerido pela IA:', equipeId);
          console.log('🔍 Tipo do ID sugerido:', typeof equipeId);
          console.log('🔍 Confiança:', aiResult.confianca);
          
          if (!equipeId || equipeId === 'null' || aiResult.confianca === 'baixa') {
            console.log('IA incerta sobre equipe - direcionando para Concierge Operação');
            equipeId = CONCIERGE_OPERACAO_ID;
          }
          
          // Buscar nome da equipe pelo ID (garantir que ambos sejam strings)
          let equipeNome: string | null = null;
          const equipeIdString = String(equipeId);
          
          const equipeEncontrada = equipes.find(e => String(e.id) === equipeIdString);
          
          if (equipeEncontrada) {
            equipeNome = equipeEncontrada.nome;
            console.log(`✅ Equipe encontrada: ${equipeNome} (ID: ${equipeId})`);
          } else {
            // Fallback para Concierge Operação se equipe não encontrada
            console.log(`⚠️ Equipe ${equipeId} não encontrada na lista. Usando Concierge Operação.`);
            const concierge = equipes.find(e => String(e.id) === String(CONCIERGE_OPERACAO_ID));
            equipeNome = concierge ? concierge.nome : 'Concierge Operação';
            console.log(`⚠️ Fallback definido como: ${equipeNome}`);
          }
          
          // GARANTIR que nunca retornamos um UUID
          const equipeResponsavelFinal = equipeNome || 'Concierge Operação';
          
          console.log(`📋 Retornando equipe_responsavel: ${equipeResponsavelFinal}`);
          
          return {
            prioridade: aiResult.prioridade || 'baixo',
            titulo: titulo,
            equipe_responsavel: equipeResponsavelFinal,
            justificativa: aiResult.justificativa || 'Análise automática'
          };
          
        } catch (parseError) {
          console.error('Erro ao parsear resposta da IA:', parseError);
          return null;
        }
      }
    } else {
      console.error('Erro na API da IA:', response.status, await response.text());
    }
    
    return null;
  } catch (error) {
    console.error('Erro na classificação por IA:', error);
    return null;
  }
}

export function generateFallbackTitle(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('áudio') || desc.includes('audio') || desc.includes('som')) return 'Problema Áudio';
  if (desc.includes('planfeto') || desc.includes('panfleto') || desc.includes('mídia')) return 'Criação Mídia';
  if (desc.includes('solicitar') || desc.includes('preciso') || desc.includes('gostaria')) return 'Solicitação Material';
  if (desc.includes('sistema') || desc.includes('erro') || desc.includes('bug')) return 'Erro Sistema';
  if (desc.includes('evento')) return 'Evento Dúvida';
  
  const words = description.trim().split(/\s+/).filter(word => 
    word.length > 3 && 
    !['preciso', 'gostaria', 'solicitar', 'favor', 'olá', 'ola'].includes(word.toLowerCase())
  );
  return words.slice(0, 3).join(' ') || 'Novo Ticket';
}

export function generateFallbackClassification(message: string): ClassificationResult {
  return {
    prioridade: 'baixo',
    titulo: generateFallbackTitle(message),
    equipe_responsavel: null,
    justificativa: 'Análise automática com fallback'
  };
}

export function applyIntelligentFallback(message: string, equipes: any[]): { equipeId: string | null } {
  // SEMPRE começar com Concierge Operação como fallback seguro
  const conciergeEquipe = equipes?.find(e => String(e.id) === String(CONCIERGE_OPERACAO_ID));
  let fallbackEquipeId = conciergeEquipe ? conciergeEquipe.id : CONCIERGE_OPERACAO_ID;
  
  console.log(`Fallback inteligente: equipe=${fallbackEquipeId === CONCIERGE_OPERACAO_ID ? 'Concierge Operação' : 'Específica'}`);
  
  return { equipeId: fallbackEquipeId };
}