/**
 * AI-powered ticket classification engine
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { openAI } from './openai-client.ts';
import { wrapAIFunction } from '../_shared/ai-alert-utils.ts';

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

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

  return await wrapAIFunction(
    'TypebotClassifier-AI',
    'typebot-webhook/ai-classifier/classifyTeamOnly',
    async () => {
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

Responda APENAS com um JSON válido no formato:
{
  "equipe_responsavel": "nome_da_equipe_escolhida",
  "justificativa": "explicação de 1-2 frases do porquê desta equipe"
}

Escolha a equipe que melhor se adequa ao problema descrito.`;

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
        
        if (!result.equipe_responsavel) {
          throw new Error('IA não retornou equipe válida');
        }

        console.log('Resultado da classificação de equipe:', result);
        return result;

      } catch (error) {
        console.error('Erro na classificação de equipe por IA:', error);
        return null;
      }
    }
  );
}

export async function classifyTicket(message: string, equipes: any[]): Promise<ClassificationResult | null> {
  if (!openaiApiKey || !equipes || equipes.length === 0) {
    return null;
  }

  return await wrapAIFunction(
    'TypebotClassifier-AI',
    'typebot-webhook/ai-classifier/classifyTicket',
    async () => {
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

ANÁLISE: "${message}"

Responda APENAS em JSON válido:
{
  "categoria": "uma_das_categorias_definidas",
  "prioridade": "uma_das_5_prioridades_definidas",
  "titulo": "Título de 3 palavras descritivo",
  "equipe_sugerida": "id_da_equipe_mais_apropriada_ou_null",
  "justificativa": "Breve explicação da análise e por que escolheu esta equipe"
}

CRÍTICO: Use APENAS estas 5 prioridades: baixo, medio, alto, imediato, crise
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
              
              return {
                categoria: aiResult.categoria || 'outro',
                prioridade: aiResult.prioridade || 'posso_esperar',
                titulo: titulo,
                equipe_responsavel: aiResult.equipe_sugerida,
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
      } catch (error) {
        console.error('Erro na classificação por IA:', error);
        throw error;
      }

      return null;
    }
  );
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
  let fallbackEquipeId = equipes?.[0]?.id || null;
  
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
  
  const equipeCompativel = equipes?.find(eq => 
    eq.nome.toLowerCase().includes(fallbackCategoria) || 
    eq.descricao?.toLowerCase().includes(fallbackCategoria)
  );
  
  if (equipeCompativel) {
    fallbackEquipeId = equipeCompativel.id;
  }
  
  return { categoria: fallbackCategoria, equipeId: fallbackEquipeId };
}