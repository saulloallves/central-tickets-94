import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface TicketForAnalysis {
  id: string;
  codigo_ticket: string;
  titulo: string;
  descricao_problema: string;
  categoria?: string;
  data_abertura: string;
  unidade_id: string;
  prioridade: string;
}

interface SimilarityGroup {
  problem_type: string;
  confidence: number;
  reasoning: string;
  ticket_ids: string[];
  suggested_crisis_title: string;
  keywords: string[];
}

interface BulkAnalysisRequest {
  equipe_id: string;
  auto_create_crises?: boolean;
  min_tickets_per_group?: number;
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

    const { equipe_id, auto_create_crises = false, min_tickets_per_group = 3 }: BulkAnalysisRequest = await req.json();
    
    console.log('🔍 Iniciando análise em massa para equipe:', equipe_id);

    // 1. Buscar todos os tickets abertos da equipe que não estão vinculados a crises ativas
    const { data: openTickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        id, codigo_ticket, titulo, descricao_problema, categoria, 
        data_abertura, unidade_id, prioridade
      `)
      .eq('equipe_responsavel_id', equipe_id)
      .in('status', ['aberto', 'em_atendimento'])
      .gte('data_abertura', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 7 dias
      .order('data_abertura', { ascending: false });

    if (ticketsError) {
      throw new Error(`Erro ao buscar tickets: ${ticketsError.message}`);
    }

    if (!openTickets || openTickets.length < min_tickets_per_group) {
      return new Response(JSON.stringify({
        action: "insufficient_tickets",
        tickets_found: openTickets?.length || 0,
        min_required: min_tickets_per_group
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filtrar tickets não vinculados a crises ativas
    const { data: linkedTickets } = await supabase
      .from('crise_ticket_links')
      .select('ticket_id, crises!inner(is_active)')
      .in('ticket_id', openTickets.map(t => t.id));

    const linkedTicketIds = linkedTickets
      ?.filter(link => link.crises?.is_active)
      ?.map(link => link.ticket_id) || [];

    const unlinkedTickets = openTickets.filter(ticket => 
      !linkedTicketIds.includes(ticket.id)
    );

    console.log(`📋 Encontrados ${unlinkedTickets.length} tickets não vinculados para análise`);

    if (unlinkedTickets.length < min_tickets_per_group) {
      return new Response(JSON.stringify({
        action: "insufficient_unlinked_tickets",
        unlinked_tickets: unlinkedTickets.length,
        min_required: min_tickets_per_group
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Usar GPT para analisar e agrupar tickets por similaridade
    const similarityGroups = await analyzeTicketSimilarity(openaiApiKey, unlinkedTickets);

    console.log(`🎯 IA identificou ${similarityGroups.length} grupos de problemas similares`);

    const results = [];

    // 3. Para cada grupo com tickets suficientes, criar crise se solicitado
    for (const group of similarityGroups) {
      if (group.ticket_ids.length >= min_tickets_per_group) {
        console.log(`📊 Grupo "${group.problem_type}": ${group.ticket_ids.length} tickets`);
        
        if (auto_create_crises) {
          const criseId = await createCriseFromGroup(supabase, equipe_id, group, unlinkedTickets);
          results.push({
            group: group.problem_type,
            tickets_count: group.ticket_ids.length,
            crise_created: true,
            crise_id: criseId,
            ticket_ids: group.ticket_ids
          });
        } else {
          results.push({
            group: group.problem_type,
            tickets_count: group.ticket_ids.length,
            crise_created: false,
            suggested_title: group.suggested_crisis_title,
            reasoning: group.reasoning,
            ticket_ids: group.ticket_ids
          });
        }
      }
    }

    return new Response(JSON.stringify({
      action: "bulk_analysis_completed",
      equipe_id,
      total_tickets_analyzed: unlinkedTickets.length,
      groups_found: similarityGroups.length,
      groups_with_sufficient_tickets: results.length,
      results,
      auto_create_crises
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na análise em massa:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function analyzeTicketSimilarity(
  apiKey: string,
  tickets: TicketForAnalysis[]
): Promise<SimilarityGroup[]> {
  
  // Preparar dados dos tickets para análise
  const ticketsForAnalysis = tickets.map(ticket => ({
    id: ticket.id,
    codigo: ticket.codigo_ticket,
    titulo: ticket.titulo,
    descricao: ticket.descricao_problema,
    categoria: ticket.categoria || 'N/A'
  }));

  const systemPrompt = `Você é um analista especializado em agrupar tickets de suporte por similaridade de problemas.

Sua tarefa é analisar uma lista de tickets e identificar grupos de tickets que tratam do mesmo tipo de problema ou têm causas relacionadas.

Critérios para agrupamento:
1. Problemas que afetam o mesmo sistema/funcionalidade
2. Sintomas similares ou idênticos
3. Causas potencialmente relacionadas
4. Impacto similar nos usuários

Responda APENAS com um JSON válido contendo um array de grupos:`;

  const userPrompt = `Analise estes tickets e agrupe-os por similaridade de problemas:

${JSON.stringify(ticketsForAnalysis, null, 2)}

Responda com um JSON no formato:
{
  "groups": [
    {
      "problem_type": "Nome descritivo do tipo de problema",
      "confidence": 0.95,
      "reasoning": "Explicação de por que estes tickets foram agrupados",
      "ticket_ids": ["id1", "id2", "id3"],
      "suggested_crisis_title": "Título sugerido para a crise",
      "keywords": ["palavra1", "palavra2", "palavra3"]
    }
  ]
}

Regras importantes:
- Só agrupe tickets que realmente têm problemas relacionados
- Mínimo de 2 tickets por grupo
- Seja específico na descrição do problema
- Use alta confiança (>0.8) apenas para agrupamentos óbvios`;

  console.log('🤖 Enviando tickets para análise GPT:', {
    total_tickets: tickets.length,
    model: 'gpt-5-2025-08-07'
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 2000,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro na API OpenAI: ${response.statusText}`);
  }

  const data = await response.json();
  const analysis = JSON.parse(data.choices[0].message.content);
  
  console.log('✅ Análise GPT concluída:', {
    groups_identified: analysis.groups?.length || 0
  });
  
  return analysis.groups || [];
}

async function createCriseFromGroup(
  supabase: any,
  equipeId: string,
  group: SimilarityGroup,
  allTickets: TicketForAnalysis[]
): Promise<string> {
  
  // Buscar detalhes dos tickets do grupo
  const groupTickets = allTickets.filter(t => group.ticket_ids.includes(t.id));
  
  // Criar descrição detalhada da crise
  let descricaoDetalhada = `Crise criada automaticamente pela análise IA em massa\n\n`;
  descricaoDetalhada += `TIPO DE PROBLEMA: ${group.problem_type}\n`;
  descricaoDetalhada += `CONFIANÇA DA IA: ${(group.confidence * 100).toFixed(1)}%\n`;
  descricaoDetalhada += `ANÁLISE: ${group.reasoning}\n\n`;
  descricaoDetalhada += `TICKETS AFETADOS (${groupTickets.length}):\n`;
  
  groupTickets.forEach((ticket, index) => {
    descricaoDetalhada += `${index + 1}. ${ticket.codigo_ticket}: ${ticket.titulo}\n`;
    descricaoDetalhada += `   Descrição: ${ticket.descricao_problema}\n`;
    descricaoDetalhada += `   Unidade: ${ticket.unidade_id}\n\n`;
  });

  // Criar a crise
  const { data: newCrise, error: criseError } = await supabase
    .from('crises')
    .insert({
      titulo: group.suggested_crisis_title,
      descricao: descricaoDetalhada,
      equipe_id: equipeId,
      problem_signature: `${equipeId}_bulk_${Date.now()}_${group.problem_type.replace(/\s+/g, '_').toLowerCase()}`,
      similar_terms: group.keywords,
      status: 'aberto',
      is_active: true,
      tickets_count: groupTickets.length,
      abriu_por: null
    })
    .select('id')
    .single();

  if (criseError) {
    throw new Error(`Erro ao criar crise: ${criseError.message}`);
  }

  // Vincular todos os tickets do grupo à crise
  for (const ticket of groupTickets) {
    await linkTicketToCrise(supabase, ticket.id, newCrise.id);
    
    // Atualizar prioridade dos tickets para crise
    await supabase
      .from('tickets')
      .update({ 
        prioridade: 'crise',
        escalonamento_nivel: 5
      })
      .eq('id', ticket.id);
  }

  // Criar update inicial da crise
  await supabase
    .from('crise_updates')
    .insert({
      crise_id: newCrise.id,
      tipo: 'criacao',
      status: 'aberto',
      mensagem: `Crise criada automaticamente através de análise IA em massa. ${groupTickets.length} tickets similares identificados e vinculados.`,
      created_by: null
    });

  console.log(`✅ Crise criada: ${newCrise.id} com ${groupTickets.length} tickets`);
  
  return newCrise.id;
}

async function linkTicketToCrise(
  supabase: any,
  ticketId: string,
  criseId: string
): Promise<void> {
  const { error: linkError } = await supabase
    .from('crise_ticket_links')
    .insert({
      crise_id: criseId,
      ticket_id: ticketId,
      linked_by: null
    })
    .on('conflict', 'do_nothing');

  if (linkError) {
    console.error('Erro ao vincular ticket à crise:', linkError);
  }
}