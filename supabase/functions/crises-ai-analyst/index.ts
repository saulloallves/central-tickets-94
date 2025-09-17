import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface TicketAnalysisRequest {
  ticket_id: string;
  titulo: string;
  descricao_problema: string;
  categoria?: string;
  equipe_id: string;
}

interface ExistingProblem {
  id: string;
  titulo: string;
  problem_signature?: string;
  tickets_count: number;
}

interface AIAnalysisResponse {
  ticket_corresponde: "sim" | "nao";
  id_problema_correspondente?: string;
  confianca: number;
  reasoning: string;
}

interface CrisisAISettings {
  system_prompt: string;
  user_prompt: string;
  threshold_similares: number;
  keywords_base: string[];
  similarity_threshold: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const ticketData: TicketAnalysisRequest = await req.json();
    console.log('🔍 Analisando ticket individual:', ticketData.ticket_id, 'da equipe:', ticketData.equipe_id);

    // Buscar configurações de IA para crises
    const { data: settingsData, error: settingsError } = await supabase
      .from('crisis_ai_settings')
      .select('*')
      .eq('ativo', true)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching crisis AI settings:', settingsError);
      throw new Error('Failed to fetch crisis AI settings');
    }

    // Usar configurações padrão se não encontrar na base
    const settings: CrisisAISettings = settingsData || {
      system_prompt: 'Você é um analista especializado em identificar padrões de problemas técnicos e relacionar tickets de suporte a problemas existentes.',
      user_prompt: `NOVO TICKET:
Título: {{TITULO}}
Descrição: {{DESCRICAO}}
Categoria: {{CATEGORIA}}

PROBLEMAS EXISTENTES ATIVOS:
{{EXISTING_PROBLEMS}}

Analise se o novo ticket corresponde a algum dos problemas existentes.

Responda APENAS com um JSON válido:
{
  "ticket_corresponde": "sim" ou "nao",
  "id_problema_correspondente": "ID do problema se corresponde, null caso contrário",
  "confianca": número de 0 a 100,
  "reasoning": "explicação da análise"
}`,
      threshold_similares: 5,
      keywords_base: ['sistema', 'caiu', 'fora', 'ar', 'indisponivel', 'indisponível', 'travou', 'lento', 'nao', 'não', 'funciona', 'funcionando', 'acesso', 'login', 'entrar', 'conectar', 'conexao', 'erro', 'falha', 'problema'],
      similarity_threshold: 0.7
    };

    console.log('Using crisis AI settings:', { 
      threshold: settings.threshold_similares, 
      similarity_threshold: settings.similarity_threshold,
      keywords_count: settings.keywords_base.length 
    });

    // 1. Filtrar categorias rotineiras que não devem gerar crises
    const routineCategories = ['midia', 'comunicacao', 'comunicação', 'design', 'redes_sociais', 'conteudo', 'marketing'];
    if (ticketData.categoria && routineCategories.includes(ticketData.categoria.toLowerCase())) {
      console.log(`🚫 Categoria rotineira detectada: ${ticketData.categoria}. Não criará crise.`);
      return new Response(JSON.stringify({
        action: "no_action",
        similar_tickets_count: 0,
        reason: "routine_category",
        threshold: settings.threshold_similares
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verificar cooldown por equipe (evitar múltiplas crises em 30 minutos)
    const { data: recentTeamCrises } = await supabase
      .from('crises')
      .select('id, created_at')
      .eq('equipe_id', ticketData.equipe_id)
      .eq('is_active', true)
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    if (recentTeamCrises && recentTeamCrises.length > 0) {
      console.log(`🚫 Cooldown ativo. Equipe já tem ${recentTeamCrises.length} crise(s) ativa(s) nos últimos 30 minutos.`);
      return new Response(JSON.stringify({
        action: "no_action",
        similar_tickets_count: 0,
        reason: "team_cooldown",
        threshold: settings.threshold_similares
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Buscar crises ativas da mesma equipe para tentar vincular
    const { data: activeProblems, error: problemsError } = await supabase
      .from('crises')
      .select('id, titulo, problem_signature, tickets_count, similar_terms')
      .eq('equipe_id', ticketData.equipe_id)
      .eq('is_active', true)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24 horas
      .order('created_at', { ascending: false });

    if (problemsError) {
      throw new Error(`Erro ao buscar problemas ativos: ${problemsError.message}`);
    }

    console.log(`🔍 Crises ativas encontradas: ${activeProblems?.length || 0}`);

    // 4. Verificar se alguma crise ativa é similar ao ticket atual
    if (activeProblems && activeProblems.length > 0) {
      // Análise simples por palavras-chave primeiro
      const currentDescription = ticketData.descricao_problema.toLowerCase();
      const currentTitle = ticketData.titulo.toLowerCase();
      
      for (const crisis of activeProblems) {
        if (crisis.similar_terms && crisis.similar_terms.length > 0) {
          const hasMatchingTerms = crisis.similar_terms.some(term => 
            currentDescription.includes(term.toLowerCase()) || 
            currentTitle.includes(term.toLowerCase())
          );
          
          if (hasMatchingTerms) {
            console.log(`🎯 Crise similar encontrada por palavra-chave: ${crisis.titulo}`);
            await linkTicketToCrise(supabase, ticketData.ticket_id, crisis.id);
            
            return new Response(JSON.stringify({
              action: "linked_to_existing",
              crise_id: crisis.id,
              reasoning: `Ticket vinculado à crise existente por palavra-chave: ${crisis.titulo}`
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }

      // Se não encontrou por palavra-chave, usar IA para análise mais profunda
      if (activeProblems.length > 0) {
        const analysis = await analyzeTicketWithAI(
          openaiApiKey,
          ticketData,
          activeProblems,
          settings
        );

        if (analysis.ticket_corresponde === "sim" && analysis.id_problema_correspondente) {
          await linkTicketToCrise(supabase, ticketData.ticket_id, analysis.id_problema_correspondente);
          
          return new Response(JSON.stringify({
            action: "linked_to_existing_ai",
            crise_id: analysis.id_problema_correspondente,
            reasoning: analysis.reasoning
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // 5. Buscar tickets similares recentes da mesma equipe (últimas 2 horas)
    const { data: allTickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, titulo, descricao_problema')
      .eq('equipe_responsavel_id', ticketData.equipe_id)
      .in('status', ['aberto', 'em_atendimento', 'escalonado'])
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Últimas 2 horas
      .order('created_at', { ascending: false })
      .limit(20);

    if (ticketsError) {
      throw new Error(`Erro ao buscar tickets individuais: ${ticketsError.message}`);
    }

    // 6. Filtrar tickets que não estão vinculados a crises ativas
    let individualTickets = [];
    if (allTickets) {
      const { data: linkedTickets } = await supabase
        .from('crise_ticket_links')
        .select('ticket_id, crises!inner(is_active)')
        .in('ticket_id', allTickets.map(t => t.id));

      const linkedTicketIds = linkedTickets
        ?.filter(link => link.crises?.is_active)
        ?.map(link => link.ticket_id) || [];

      individualTickets = allTickets.filter(ticket => 
        !linkedTicketIds.includes(ticket.id)
      );
    }

    console.log(`Encontrados ${allTickets?.length || 0} tickets da equipe, ${individualTickets.length} não vinculados a crises`);

    // 7. Contar tickets similares (usando lógica mais restritiva)
    const similarResult = await countSimilarTickets(supabase, ticketData, individualTickets, settings);
    const { count: similarCount, similarTickets } = similarResult;
    
    // USAR O THRESHOLD REAL DA CONFIGURAÇÃO (não override para 2)
    const effectiveThreshold = settings.threshold_similares;
    
    console.log(`📊 Análise de similaridade: ${similarCount} tickets similares encontrados. Threshold necessário: ${effectiveThreshold}`);
    
    // CORRIGIR: Só criar crise se tiver tickets similares ALÉM do atual (count > threshold)
    if (similarCount >= effectiveThreshold) {
      // DUPLA VERIFICAÇÃO: Buscar se já existe crise recente para esta equipe
      const { data: recentCrises } = await supabase
        .from('crises')
        .select('id, titulo, similar_terms, problem_signature')
        .eq('equipe_id', ticketData.equipe_id)
        .eq('is_active', true)
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Últimos 15 minutos
        .order('created_at', { ascending: false });

      // Se há uma crise muito recente com termos similares, vincular a ela
      if (recentCrises && recentCrises.length > 0) {
        const currentKeywords = ticketData.descricao_problema.toLowerCase().split(' ');
        
        for (const recentCrisis of recentCrises) {
          if (recentCrisis.similar_terms) {
            const hasMatchingTerms = recentCrisis.similar_terms.some(term => 
              currentKeywords.some(keyword => 
                keyword.includes(term.toLowerCase()) || term.toLowerCase().includes(keyword)
              )
            );
            
            if (hasMatchingTerms) {
              console.log(`🔗 Vinculando à crise recente: ${recentCrisis.titulo} (ID: ${recentCrisis.id})`);
              await linkTicketToCrise(supabase, ticketData.ticket_id, recentCrisis.id);
              
              return new Response(JSON.stringify({
                action: "linked_to_recent",
                crise_id: recentCrisis.id,
                reasoning: `Vinculado à crise recente: ${recentCrisis.titulo}`
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        }
      }

      // VERIFICAÇÃO FINAL: Buscar usando signature única para evitar corrida de condição
      const problemSignature = `${ticketData.equipe_id}_${ticketData.categoria || 'geral'}_sistema`;
      const { data: signatureCheck } = await supabase
        .from('crises')
        .select('id, titulo')
        .eq('equipe_id', ticketData.equipe_id)
        .eq('problem_signature', problemSignature)
        .eq('is_active', true)
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .single();

      if (signatureCheck) {
        console.log(`🔗 Crise com signature encontrada: ${signatureCheck.titulo} (ID: ${signatureCheck.id})`);
        await linkTicketToCrise(supabase, ticketData.ticket_id, signatureCheck.id);
        
        return new Response(JSON.stringify({
          action: "linked_to_signature_match",
          crise_id: signatureCheck.id,
          reasoning: `Vinculado à crise existente por signature: ${signatureCheck.titulo}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Criar nova crise apenas se passou por todas as verificações
      const newCriseId = await createNewCrise(supabase, ticketData, similarTickets, settings);
      
      return new Response(JSON.stringify({
        action: "new_crise_created",
        crise_id: newCriseId,
        similar_tickets_count: similarCount,
        similar_tickets: similarTickets.map(t => ({ 
          id: t.id, 
          titulo: t.titulo, 
          descricao: t.descricao_problema 
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Se não há tickets suficientes para crise, apenas registrar
    return new Response(JSON.stringify({
      action: "no_action",
      similar_tickets_count: similarCount,
      threshold: settings.threshold_similares
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na análise de crise:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeTicketWithAI(
  apiKey: string,
  ticket: TicketAnalysisRequest,
  existingProblems: ExistingProblem[],
  settings: CrisisAISettings
): Promise<AIAnalysisResponse> {
  // Substituir placeholders no template
  const existingProblemsText = existingProblems.map(p => 
    `ID: ${p.id}\nTítulo: ${p.titulo}\nTickets relacionados: ${p.tickets_count}\nDescrição: ${p.descricao || 'N/A'}`
  ).join('\n\n');

  const userPrompt = settings.user_prompt
    .replace('{{TITULO}}', ticket.titulo)
    .replace('{{DESCRICAO}}', ticket.descricao_problema)
    .replace('{{CATEGORIA}}', ticket.categoria || 'N/A')
    .replace('{{EXISTING_PROBLEMS}}', existingProblemsText);

  console.log('AI Analysis - Using prompts:', {
    system_prompt_length: settings.system_prompt.length,
    user_prompt_length: userPrompt.length,
    existing_problems_count: existingProblems.length
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: settings.system_prompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 500,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro na API OpenAI: ${response.statusText}`);
  }

  const data = await response.json();
  const analysis = JSON.parse(data.choices[0].message.content);
  
  console.log('Resultado da análise IA:', analysis);
  
  return analysis;
}

async function linkTicketToCrise(
  supabase: any,
  ticketId: string,
  criseId: string
): Promise<void> {
  // Verificar se já está vinculado
  const { data: existingLink } = await supabase
    .from('crise_ticket_links')
    .select('id')
    .eq('ticket_id', ticketId)
    .eq('crise_id', criseId)
    .single();

  if (existingLink) {
    console.log('Ticket já vinculado à crise');
    return;
  }

  // Criar vínculo
  const { error: linkError } = await supabase
    .from('crise_ticket_links')
    .insert({
      crise_id: criseId,
      ticket_id: ticketId,
      linked_by: null
    });

  if (linkError) {
    console.error('Erro ao vincular ticket à crise:', linkError);
    return;
  }

  // Atualizar contador de tickets na crise
  const { error: updateError } = await supabase
    .from('crises')
    .update({ 
      tickets_count: supabase.rpc('increment_tickets_count', { crise_id: criseId }),
      updated_at: new Date().toISOString()
    })
    .eq('id', criseId);

  if (updateError) {
    console.error('Erro ao atualizar contador da crise:', updateError);
  }

  console.log(`✅ Ticket ${ticketId} vinculado à crise ${criseId}`);
}

async function countSimilarTickets(
  supabase: any,
  newTicket: TicketAnalysisRequest,
  individualTickets: any[],
  settings: CrisisAISettings
): Promise<{ count: number, similarTickets: any[] }> {
  console.log('🔍 Analisando similaridade para ticket:', newTicket.descricao_problema);
  console.log('📋 Tickets individuais encontrados:', individualTickets.length);
  
  // Detectar palavras-chave do ticket atual
  const currentDescription = newTicket.descricao_problema.toLowerCase();
  const currentTitle = (newTicket.titulo || '').toLowerCase();
  
  // Usar palavras-chave das configurações
  const systemIssueKeywords = settings.keywords_base;
  
  // Extrair palavras-chave principais do ticket atual (palavras com 4+ letras, excluindo comuns)
  const stopWords = ['para', 'com', 'uma', 'por', 'das', 'dos', 'que', 'quando', 'onde', 'como', 'este', 'esta', 'isso', 'aqui', 'ali', 'preciso', 'vetor', 'evento', 'midias'];
  const currentSpecificKeywords = currentDescription
    .split(/\s+/)
    .filter(word => word.length >= 4 && !stopWords.includes(word))
    .slice(0, 5); // Pegar até 5 palavras principais
  
  console.log('🎯 Palavras específicas extraídas:', currentSpecificKeywords);
  
  // Detectar palavras-chave do sistema no ticket atual
  const currentSystemKeywords = systemIssueKeywords.filter(keyword => 
    currentDescription.includes(keyword) || currentTitle.includes(keyword)
  );
  
  console.log('🎯 Palavras-chave do sistema encontradas:', currentSystemKeywords);
  
  // CONTAR APENAS tickets similares (NÃO incluir o atual)
  let count = 0;
  const similarTickets = [];
  
  for (const ticket of individualTickets) {
    const description = (ticket.descricao_problema || '').toLowerCase();
    const title = (ticket.titulo || '').toLowerCase();
    
    // 1. Verificar palavras-chave do sistema
    const systemMatches = currentSystemKeywords.filter(keyword => 
      description.includes(keyword) || title.includes(keyword)
    ).length;
    
    // 2. Verificar palavras específicas
    const specificMatches = currentSpecificKeywords.filter(keyword => 
      description.includes(keyword) || title.includes(keyword)
    ).length;
    
    // 3. Análise de similaridade textual
    const textSimilarity = calculateTextSimilarity(currentDescription, description);
    
    console.log(`   - Sistema: ${systemMatches}, Específicas: ${specificMatches}, Similaridade: ${(textSimilarity * 100).toFixed(1)}%`);
    
    // Critério MAIS RESTRITIVO: Precisa de múltiplos indicadores
    const isSystemIssue = systemMatches >= 2; // Pelo menos 2 palavras-chave do sistema
    const isSpecificMatch = specificMatches >= 3; // Pelo menos 3 palavras específicas
    const isHighSimilarity = textSimilarity > (settings.similarity_threshold + 0.1); // Threshold mais alto
    
    if (isSystemIssue || (isSpecificMatch && textSimilarity > settings.similarity_threshold) || isHighSimilarity) {
      count++;
      similarTickets.push(ticket);
      console.log(`✅ Ticket similar encontrado: "${ticket.titulo}"`);
    }
  }
  
  console.log(`📊 Total de tickets similares: ${count} (NÃO incluindo o atual)`);
  console.log(`🎯 Threshold necessário: ${settings.threshold_similares} tickets similares`);
  
  return { count, similarTickets };
}

// Função auxiliar para calcular similaridade textual básica
function calculateTextSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1.0;
  
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

async function createNewCrise(
  supabase: any,
  ticket: TicketAnalysisRequest,
  similarTickets: any[],
  settings: CrisisAISettings
): Promise<string> {
  // Extrair palavras-chave principais do problema
  const problemKeywords = ticket.descricao_problema
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length >= 4 && !['para', 'com', 'uma', 'por', 'das', 'dos'].includes(word))
    .slice(0, 5);

  const titulo = `Incidente ${ticket.categoria || 'Sistema'}: ${problemKeywords.slice(0, 3).join(' ')}`;
  
  const descricao = `Crise detectada automaticamente baseada em ${similarTickets.length + 1} tickets similares:

TICKET INICIAL:
- ${ticket.titulo}
- ${ticket.descricao_problema}

TICKETS RELACIONADOS:
${similarTickets.map(t => `- ${t.titulo}: ${t.descricao_problema}`).join('\n')}

Esta crise foi criada automaticamente pelo sistema de detecção baseado nos critérios configurados.`;

  // Inserir nova crise
  const { data: newCrise, error: criseError } = await supabase
    .from('crises')
    .insert({
      titulo,
      descricao,
      palavras_chave: problemKeywords,
      similar_terms: problemKeywords,
      equipe_id: ticket.equipe_id,
      problem_signature: `${ticket.equipe_id}_${ticket.categoria || 'geral'}_sistema`,
      status: 'aberto',
      abriu_por: null,
      tickets_count: similarTickets.length + 1
    })
    .select()
    .single();

  if (criseError) {
    console.error('Erro ao criar crise:', criseError);
    throw new Error(`Erro ao criar crise: ${criseError.message}`);
  }

  console.log(`🆕 Nova crise criada: ${newCrise.id} com ${similarTickets.length + 1} tickets similares`);

  // Vincular o ticket inicial
  await linkTicketToCrise(supabase, ticket.ticket_id, newCrise.id);

  // Vincular tickets similares
  const ticketsToLink = [ticket.ticket_id, ...similarTickets.map(t => t.id)];
  console.log('📋 Tickets vinculados:', ticketsToLink);

  for (const ticketId of similarTickets.map(t => t.id)) {
    await linkTicketToCrise(supabase, ticketId, newCrise.id);
  }

  return newCrise.id;
}