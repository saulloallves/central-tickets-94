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
    console.log('Analisando ticket:', ticketData.ticket_id, 'da equipe:', ticketData.equipe_id);

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

    // 1. Buscar crises ativas da mesma equipe (últimas 4 horas)
    const { data: activeProblems, error: problemsError } = await supabase
      .from('crises')
      .select('id, titulo, problem_signature, tickets_count, similar_terms')
      .eq('equipe_id', ticketData.equipe_id)
      .eq('is_active', true)
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (problemsError) {
      throw new Error(`Erro ao buscar problemas ativos: ${problemsError.message}`);
    }

    console.log(`🔍 Crises ativas encontradas: ${activeProblems?.length || 0}`);

    // 2. Verificar se já existe uma crise ativa para este tipo de problema
    let existingCrisisForSimilarProblem = null;
    if (activeProblems && activeProblems.length > 0) {
      // Buscar por palavras-chave similares primeiro
      const currentProblemKeywords = ticketData.descricao_problema.toLowerCase().split(' ');
      
      for (const crisis of activeProblems) {
        if (crisis.similar_terms) {
          const hasMatchingTerms = crisis.similar_terms.some(term => 
            currentProblemKeywords.some(keyword => 
              keyword.includes(term.toLowerCase()) || term.toLowerCase().includes(keyword)
            )
          );
          
          if (hasMatchingTerms) {
            console.log(`🎯 Crise similar encontrada: ${crisis.titulo}`);
            existingCrisisForSimilarProblem = crisis;
            break;
          }
        }
      }
    }

    // 3. Se encontrou crise similar, vincular o ticket a ela
    if (existingCrisisForSimilarProblem) {
      await linkTicketToCrise(supabase, ticketData.ticket_id, existingCrisisForSimilarProblem.id);
      
      return new Response(JSON.stringify({
        action: "linked_to_existing",
        crise_id: existingCrisisForSimilarProblem.id,
        reasoning: `Ticket vinculado à crise existente: ${existingCrisisForSimilarProblem.titulo}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Se não há crises ativas similares, verificar tickets individuais da equipe
    const { data: allTickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, titulo, descricao_problema')
      .eq('equipe_responsavel_id', ticketData.equipe_id)
      .in('status', ['aberto', 'em_atendimento', 'escalonado'])
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (ticketsError) {
      throw new Error(`Erro ao buscar tickets individuais: ${ticketsError.message}`);
    }

    // 5. Filtrar tickets que não estão vinculados a crises ativas
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

    // 6. Usar IA para análise se há problemas ativos
    if (activeProblems && activeProblems.length > 0) {
      const analysis = await analyzeTicketWithAI(
        openaiApiKey,
        ticketData,
        activeProblems,
        settings
      );

      if (analysis.ticket_corresponde === "sim" && analysis.id_problema_correspondente) {
        // Vincular à crise existente
        await linkTicketToCrise(supabase, ticketData.ticket_id, analysis.id_problema_correspondente);
        
        return new Response(JSON.stringify({
          action: "linked_to_existing",
          crise_id: analysis.id_problema_correspondente,
          reasoning: analysis.reasoning
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 7. Contar tickets similares para decidir se deve criar nova crise
    const similarResult = await countSimilarTickets(supabase, ticketData, individualTickets, settings);
    const { count: similarCount, similarTickets } = similarResult;
    
    if (similarCount >= settings.threshold_similares) {
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
  
  // Detectar palavras-chave no ticket atual
  const currentKeywords = systemIssueKeywords.filter(keyword => 
    currentDescription.includes(keyword) || currentTitle.includes(keyword)
  );
  
  if (currentKeywords.length === 0) {
    console.log('❌ Nenhuma palavra-chave de sistema encontrada no ticket atual');
    return { count: 1, similarTickets: [] }; // Apenas o ticket atual
  }

  console.log('🎯 Palavras-chave encontradas:', currentKeywords);
  
  // Contar tickets similares
  const similarTickets = individualTickets.filter(ticket => {
    const description = (ticket.descricao_problema || '').toLowerCase();
    const title = (ticket.titulo || '').toLowerCase();
    
    // Contar quantas palavras-chave coincidem
    const matchingKeywords = currentKeywords.filter(keyword => 
      description.includes(keyword) || title.includes(keyword)
    );
    
    // Considerar similar se tiver pelo menos 2 palavras-chave em comum
    if (matchingKeywords.length >= 2) {
      console.log(`✅ Ticket similar encontrado: "${ticket.titulo || ticket.descricao_problema}" (keywords: ${matchingKeywords.length})`);
      return true;
    }
    
    return false;
  });
  
  const totalSimilar = similarTickets.length + 1; // +1 para incluir o ticket atual
  console.log(`🎯 Total de tickets similares: ${totalSimilar}`);
  
  return { count: totalSimilar, similarTickets };
}

async function createNewCrise(
  supabase: any,
  ticket: TicketAnalysisRequest,
  similarTickets: any[],
  settings: CrisisAISettings
): Promise<string> {
  // Extrair palavras-chave para categorizar a crise
  const problemKeywords = ticket.descricao_problema
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 3)
    .slice(0, 3); // Primeiras 3 palavras significativas
  
  // Criar descrição detalhada incluindo tickets similares
  let descricaoDetalhada = `Crise detectada automaticamente devido a ${similarTickets.length + 1} tickets similares:\n\n`;
  descricaoDetalhada += `TICKET PRINCIPAL:\n- ${ticket.titulo}: ${ticket.descricao_problema}\n\n`;
  
  if (similarTickets.length > 0) {
    descricaoDetalhada += "TICKETS SIMILARES:\n";
    similarTickets.forEach((t, index) => {
      descricaoDetalhada += `- ${t.titulo || 'Sem título'}: ${t.descricao_problema || 'Sem descrição'}\n`;
    });
  }

  const { data: newCrise, error: criseError } = await supabase
    .from('crises')
    .insert({
      titulo: `Crise automática: ${ticket.titulo}`,
      descricao: descricaoDetalhada,
      equipe_id: ticket.equipe_id,
      problem_signature: `${ticket.equipe_id}_${ticket.categoria || 'geral'}_sistema`,
      similar_terms: problemKeywords,
      status: 'aberto',
      is_active: true,
      tickets_count: 1,
      abriu_por: null
    })
    .select('id')
    .single();

  if (criseError) {
    throw new Error(`Erro ao criar crise: ${criseError.message}`);
  }

  // Vincular o ticket atual à nova crise
  await linkTicketToCrise(supabase, ticket.ticket_id, newCrise.id);

  // Vincular tickets similares à crise
  for (const similarTicket of similarTickets) {
    await linkTicketToCrise(supabase, similarTicket.id, newCrise.id);
  }

  console.log(`🆕 Nova crise criada: ${newCrise.id} com ${similarTickets.length + 1} tickets similares`);
  console.log(`📋 Tickets vinculados: [${ticket.ticket_id}, ${similarTickets.map(t => t.id).join(', ')}]`);
  
  return newCrise.id;
}