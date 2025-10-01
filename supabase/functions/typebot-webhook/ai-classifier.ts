// @ts-nocheck
/**
 * AI-powered ticket classification engine
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { openAI } from './openai-client.ts';
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
  categoria: string;
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

    const equipesDisponiveis = equipes?.map(e => `- ${e.nome}: ${e.introducao || 'Sem especialidades definidas'}`).join('\n') || 'Nenhuma equipe disponível';

    const analysisPrompt = `
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

4. EQUIPE SUGERIDA: Escolha a melhor equipe baseado nas especialidades:

${equipesDisponiveis}

IMPORTANTE: Se você NÃO TIVER CERTEZA sobre qual equipe escolher, ou se o problema não se encaixar claramente em nenhuma especialidade, use "Concierge Operação" (ID: ${CONCIERGE_OPERACAO_ID}). Esta equipe está preparada para analisar e redirecionar tickets incertos.

ANÁLISE: "${message}"

Responda APENAS em JSON válido:
{
  "categoria": "uma_das_categorias_definidas",
  "prioridade": "uma_das_5_prioridades_definidas",
  "titulo": "Título de 3 palavras descritivo",
  "equipe_sugerida": "id_da_equipe_mais_apropriada_ou_${CONCIERGE_OPERACAO_ID}",
  "justificativa": "Breve explicação da análise e por que escolheu esta equipe",
  "confianca": "alta, media ou baixa"
}

CRÍTICO: 
- Use APENAS estas 5 prioridades: baixo, medio, alto, imediato, crise
- Use Concierge Operação (ID: ${CONCIERGE_OPERACAO_ID}) quando tiver dúvida sobre a equipe
`;

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
              case 'urgente':
                aiResult.prioridade = 'imediato';
                break;
            }
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
          if (!equipeId || equipeId === 'null' || aiResult.confianca === 'baixa') {
            console.log('IA incerta sobre equipe - direcionando para Concierge Operação');
            equipeId = CONCIERGE_OPERACAO_ID;
          }
          
          // Buscar nome da equipe pelo ID
          let equipeNome: string | null = null;
          const equipeEncontrada = equipes.find(e => e.id === equipeId);
          if (equipeEncontrada) {
            equipeNome = equipeEncontrada.nome;
            console.log(`✅ Equipe encontrada: ${equipeNome} (ID: ${equipeId})`);
          } else {
            // Fallback para Concierge Operação se equipe não encontrada
            const concierge = equipes.find(e => e.id === CONCIERGE_OPERACAO_ID);
            equipeNome = concierge ? concierge.nome : 'Concierge Operação';
            console.log(`⚠️ Equipe não encontrada, usando fallback: ${equipeNome}`);
          }
          
          return {
            categoria: aiResult.categoria || 'outro',
            prioridade: aiResult.prioridade || 'baixo',
            titulo: titulo,
            equipe_responsavel: equipeNome,
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
    categoria: 'outro',
    prioridade: 'baixo',
    titulo: generateFallbackTitle(message),
    equipe_responsavel: null,
    justificativa: 'Análise automática com fallback'
  };
}

export function applyIntelligentFallback(message: string, equipes: any[]): { categoria: string; equipeId: string | null } {
  const messageWords = message.toLowerCase();
  let fallbackCategoria = 'outro';
  // Por padrão, usar Concierge Operação ao invés da primeira equipe
  let fallbackEquipeId = CONCIERGE_OPERACAO_ID;
  
  if (messageWords.includes('sistema') || messageWords.includes('app') || messageWords.includes('erro') || messageWords.includes('travou')) {
    fallbackCategoria = 'sistema';
  } else if (messageWords.includes('midia') || messageWords.includes('marketing') || messageWords.includes('propaganda')) {
    fallbackCategoria = 'midia';
  } else if (messageWords.includes('juridico') || messageWords.includes('contrato') || messageWords.includes('legal')) {
    fallbackCategoria = 'juridico';
  } else if (messageWords.includes('rh') || messageWords.includes('funcionario') || messageWords.includes('folha')) {
    fallbackCategoria = 'rh';
  } else if (messageWords.includes('financeiro') || messageWords.includes('pagamento') || messageWords.includes('dinheiro')) {
    fallbackCategoria = 'financeiro';
  }
  
  // Tentar encontrar equipe específica baseada na categoria
  const equipeCompativel = equipes?.find(eq => 
    eq.nome.toLowerCase().includes(fallbackCategoria) || 
    eq.descricao?.toLowerCase().includes(fallbackCategoria)
  );
  
  if (equipeCompativel) {
    fallbackEquipeId = equipeCompativel.id;
  }
  // Caso contrário, mantém Concierge Operação como fallback
  
  console.log(`Fallback inteligente: categoria=${fallbackCategoria}, equipe=${fallbackEquipeId === CONCIERGE_OPERACAO_ID ? 'Concierge Operação' : 'Específica'}`);
  
  return { categoria: fallbackCategoria, equipeId: fallbackEquipeId };
}