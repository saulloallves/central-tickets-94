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
        activeProblems
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
    const similarCount = await countSimilarTickets(supabase, ticketData, individualTickets);
    
    if (similarCount >= 5) {
      // Verificar mais uma vez se não foi criada uma crise nos últimos minutos
      const { data: recentCrises } = await supabase
        .from('crises')
        .select('id, titulo, similar_terms')
        .eq('equipe_id', ticketData.equipe_id)
        .eq('is_active', true)
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      // Se há uma crise muito recente com termos similares, vincular a ela
      if (recentCrises && recentCrises.length > 0) {
        const recentCrisis = recentCrises[0];
        const currentKeywords = ticketData.descricao_problema.toLowerCase().split(' ');
        
        if (recentCrisis.similar_terms) {
          const hasMatchingTerms = recentCrisis.similar_terms.some(term => 
            currentKeywords.some(keyword => 
              keyword.includes(term.toLowerCase()) || term.toLowerCase().includes(keyword)
            )
          );
          
          if (hasMatchingTerms) {
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

      // Criar nova crise apenas se não há crises similares recentes
      const newCriseId = await createNewCrise(supabase, ticketData, similarCount);
      
      return new Response(JSON.stringify({
        action: "new_crise_created",
        crise_id: newCriseId,
        similar_tickets_count: similarCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Se não há tickets suficientes para crise, apenas registrar
    return new Response(JSON.stringify({
      action: "no_action",
      similar_tickets_count: similarCount,
      threshold: 5
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
  existingProblems: ExistingProblem[]
): Promise<AIAnalysisResponse> {
  const systemPrompt = `Você é um analista especializado em identificar padrões de problemas técnicos e relacionar tickets de suporte a problemas existentes.

Sua tarefa é determinar se um novo ticket corresponde a algum problema já identificado e ativo.

CRITÉRIOS PARA CORRESPONDÊNCIA:
- Problemas de sistema/infraestrutura com sintomas similares
- Mesma causa raiz aparente (ex: indisponibilidade, lentidão, falhas de conexão)
- Mesmo tipo de impacto nos usuários
- Timeframe próximo (problemas relacionados no tempo)

RETORNE SEMPRE UM JSON VÁLIDO com esta estrutura:
{
  "ticket_corresponde": "sim" ou "nao",
  "id_problema_correspondente": "ID do problema se corresponde, null caso contrário",
  "confianca": número de 0 a 100,
  "reasoning": "explicação da análise"
}`;

  const userPrompt = `NOVO TICKET:
Título: ${ticket.titulo}
Descrição: ${ticket.descricao_problema}
Categoria: ${ticket.categoria || 'N/A'}

PROBLEMAS EXISTENTES ATIVOS:
${existingProblems.map(p => 
  `ID: ${p.id}\nTítulo: ${p.titulo}\nTickets relacionados: ${p.tickets_count}`
).join('\n\n')}

Analise se o novo ticket corresponde a algum dos problemas existentes.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { role: 'system', content: systemPrompt },
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
  individualTickets: any[]
): Promise<number> {
  console.log('🔍 Analisando similaridade para ticket:', newTicket.descricao_problema);
  console.log('📋 Tickets individuais encontrados:', individualTickets.length);
  
  // Detectar palavras-chave do ticket atual
  const currentDescription = newTicket.descricao_problema.toLowerCase();
  const currentTitle = (newTicket.titulo || '').toLowerCase();
  
  // Palavras-chave que indicam problemas similares de sistema
  const systemIssueKeywords = [
    'sistema', 'caiu', 'fora', 'ar', 'indisponivel', 'indisponibilidade',
    'travou', 'lento', 'nao', 'não', 'funciona', 'funcionando', 'acesso',
    'login', 'entrar', 'conectar', 'conexao', 'erro', 'falha', 'problema'
  ];
  
  // Detectar palavras-chave no ticket atual
  const currentKeywords = systemIssueKeywords.filter(keyword => 
    currentDescription.includes(keyword) || currentTitle.includes(keyword)
  );
  
  if (currentKeywords.length === 0) {
    console.log('❌ Nenhuma palavra-chave de sistema encontrada no ticket atual');
    return 1; // Apenas o ticket atual
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
  
  return totalSimilar;
}

async function createNewCrise(
  supabase: any,
  ticket: TicketAnalysisRequest,
  similarCount: number
): Promise<string> {
  // Extrair palavras-chave do problema
  const problemKeywords = ticket.descricao_problema.toLowerCase()
    .split(' ')
    .filter(word => word.length > 3)
    .slice(0, 3); // Primeiras 3 palavras significativas

  const { data: newCrise, error: criseError } = await supabase
    .from('crises')
    .insert({
      titulo: `Crise automática: ${ticket.titulo}`,
      descricao: `Crise detectada automaticamente devido a ${similarCount} tickets similares`,
      equipe_id: ticket.equipe_id,
      problem_signature: `problema_${ticket.categoria || 'geral'}_${Date.now()}`,
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

  // Usar função SQL para vincular todos os tickets similares automaticamente
  try {
    const { data: ticketsVinculados, error: vinculacaoError } = await supabase
      .rpc('vincular_tickets_similares_a_crise', {
        p_crise_id: newCrise.id,
        p_equipe_id: ticket.equipe_id,
        p_similar_terms: problemKeywords,
        p_created_since: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      });

    if (vinculacaoError) {
      console.error('Erro ao vincular tickets similares:', vinculacaoError);
    } else {
      console.log(`🔗 Vinculados automaticamente ${ticketsVinculados} tickets similares à crise`);
    }
  } catch (error) {
    console.error('Erro na vinculação automática:', error);
  }

  console.log(`🆕 Nova crise criada: ${newCrise.id} com ${similarCount} tickets similares`);
  
  return newCrise.id;
}