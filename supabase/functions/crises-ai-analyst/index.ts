import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TicketAnalysisRequest {
  ticket_id: string;
  titulo: string;
  descricao_problema: string;
  equipe_id: string;
  categoria?: string;
}

interface ExistingProblem {
  id_problema: string;
  titulo: string;
  problem_signature: string;
  tickets_count: number;
}

interface AIAnalysisResponse {
  ticket_corresponde: "sim" | "nao";
  id_problema_correspondente: string | null;
  confianca: number;
  reasoning?: string;
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

    // 1. Buscar problemas/crises ativas da mesma equipe
    const { data: activeProblems, error: problemsError } = await supabase
      .from('crises')
      .select('id, titulo, problem_signature, tickets_count')
      .eq('equipe_id', ticketData.equipe_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (problemsError) {
      throw new Error(`Erro ao buscar problemas ativos: ${problemsError.message}`);
    }

    // 2. Se não há problemas ativos, verificar tickets individuais da equipe
    let individualTickets = [];
    if (!activeProblems || activeProblems.length === 0) {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, titulo, descricao_problema')
        .eq('equipe_responsavel_id', ticketData.equipe_id)
        .in('status', ['aberto', 'em_atendimento', 'escalonado'])
        .is('crise_link_id', null) // Não vinculados a crises
        .order('created_at', { ascending: false })
        .limit(20);

      if (ticketsError) {
        console.error('Erro ao buscar tickets individuais:', ticketsError);
      } else {
        individualTickets = tickets || [];
      }
    }

    // 3. Preparar dados para análise da IA
    const existingProblems: ExistingProblem[] = (activeProblems || []).map(p => ({
      id_problema: p.id,
      titulo: p.titulo,
      problem_signature: p.problem_signature || p.titulo,
      tickets_count: p.tickets_count
    }));

    // 4. Chamar OpenAI para análise
    const analysisResult = await analyzeTicketWithAI(
      ticketData,
      existingProblems,
      individualTickets,
      openaiApiKey
    );

    console.log('Resultado da análise IA:', analysisResult);

    // 5. Processar resultado
    if (analysisResult.ticket_corresponde === "sim" && analysisResult.id_problema_correspondente) {
      // Vincular ticket à crise existente
      await linkTicketToCrise(supabase, ticketData.ticket_id, analysisResult.id_problema_correspondente);
      
      return new Response(JSON.stringify({
        action: 'linked_to_existing',
        crise_id: analysisResult.id_problema_correspondente,
        reasoning: analysisResult.reasoning
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      // Verificar se deve criar nova crise (5+ tickets similares)
      const similarCount = await countSimilarTickets(
        supabase,
        ticketData,
        individualTickets
      );

      if (similarCount >= 5) {
        const newCriseId = await createNewCrise(supabase, ticketData, similarCount);
        return new Response(JSON.stringify({
          action: 'new_crise_created',
          crise_id: newCriseId,
          similar_tickets_count: similarCount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({
          action: 'no_action',
          similar_tickets_count: similarCount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

  } catch (error) {
    console.error('Erro na análise de crise:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Erro interno no sistema de análise de crises'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function analyzeTicketWithAI(
  ticket: TicketAnalysisRequest,
  existingProblems: ExistingProblem[],
  individualTickets: any[],
  apiKey: string
): Promise<AIAnalysisResponse> {
  const systemPrompt = `Você é um assistente virtual especialista em triagem de tickets de suporte técnico. 
Sua função é identificar se um novo ticket relata o mesmo problema de incidentes já existentes.
Problemas podem ser descritos com palavras diferentes mas se referem à mesma causa raiz.
Exemplos de problemas similares:
- "sistema caiu", "PDV travando", "não consigo acessar" = problema de indisponibilidade
- "erro ao imprimir", "impressora não funciona", "problema na impressão" = problema de impressão
- "lentidão", "sistema lento", "demora para carregar" = problema de performance`;

  const userPrompt = `Analise o 'NOVO TICKET' e verifique se corresponde a algum dos 'PROBLEMAS EXISTENTES'.

**PROBLEMAS EXISTENTES:**
${existingProblems.length > 0 ? 
  JSON.stringify(existingProblems.map(p => ({ 
    id_problema: p.id_problema, 
    titulo: p.titulo,
    tickets_count: p.tickets_count 
  })), null, 2) : 
  'Nenhum problema ativo encontrado'
}

**NOVO TICKET:**
{
  "id_ticket": "${ticket.ticket_id}",
  "titulo": "${ticket.titulo}",
  "descricao": "${ticket.descricao_problema}",
  "categoria": "${ticket.categoria || 'não informada'}"
}

**Sua Tarefa:**
Primeiro, raciocine sobre a relação entre o novo ticket e os problemas existentes.
Depois, responda APENAS em formato JSON com a seguinte estrutura:
{
  "ticket_corresponde": "sim" | "nao",
  "id_problema_correspondente": "ID do problema se a resposta for sim, ou null se for nao",
  "confianca": number (0-100),
  "reasoning": "breve explicação do seu raciocínio"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch (parseError) {
    console.error('Erro ao parsear resposta da IA:', content);
    return {
      ticket_corresponde: "nao",
      id_problema_correspondente: null,
      confianca: 0,
      reasoning: "Erro ao processar análise da IA"
    };
  }
}

async function linkTicketToCrise(supabase: any, ticketId: string, criseId: string) {
  // Vincular ticket à crise
  const { error: linkError } = await supabase
    .from('crise_ticket_links')
    .insert({
      crise_id: criseId,
      ticket_id: ticketId,
      linked_by: null // Sistema automático
    });

  if (linkError) {
    console.error('Erro ao vincular ticket à crise:', linkError);
    throw new Error(`Erro ao vincular ticket: ${linkError.message}`);
  }

  // Atualizar status da crise
  const { error: updateError } = await supabase
    .from('crises')
    .update({
      ultima_atualizacao: new Date().toISOString(),
      status: 'investigando' // Reativar se estava encerrada
    })
    .eq('id', criseId);

  if (updateError) {
    console.error('Erro ao atualizar crise:', updateError);
  }

  console.log(`Ticket ${ticketId} vinculado à crise ${criseId}`);
}

async function countSimilarTickets(
  supabase: any,
  newTicket: TicketAnalysisRequest,
  individualTickets: any[]
): Promise<number> {
  // Por simplicidade, usar contagem básica por categoria ou palavras-chave
  // Em produção, pode usar análise semântica mais sofisticada
  const similarTickets = individualTickets.filter(t => 
    t.titulo?.toLowerCase().includes('sistema') ||
    t.titulo?.toLowerCase().includes('pdv') ||
    t.titulo?.toLowerCase().includes('erro') ||
    t.descricao_problema?.toLowerCase().includes('não funciona') ||
    t.descricao_problema?.toLowerCase().includes('travou') ||
    t.descricao_problema?.toLowerCase().includes('caiu')
  );

  return similarTickets.length + 1; // +1 para incluir o ticket atual
}

async function createNewCrise(
  supabase: any,
  ticket: TicketAnalysisRequest,
  similarCount: number
): Promise<string> {
  const problemSignature = `problema_${ticket.categoria || 'geral'}_${Date.now()}`;
  
  const { data: newCrise, error: criseError } = await supabase
    .from('crises')
    .insert({
      titulo: `Crise automática: ${ticket.titulo}`,
      descricao: `Crise detectada automaticamente devido a ${similarCount} tickets similares`,
      equipe_id: ticket.equipe_id,
      problem_signature: problemSignature,
      similar_terms: [ticket.categoria || 'sistema', 'problema', 'erro'],
      status: 'aberto',
      is_active: true,
      abriu_por: null // Sistema automático
    })
    .select('id')
    .single();

  if (criseError) {
    throw new Error(`Erro ao criar crise: ${criseError.message}`);
  }

  // Vincular o ticket atual à nova crise
  await linkTicketToCrise(supabase, ticket.ticket_id, newCrise.id);

  console.log(`Nova crise criada: ${newCrise.id} para equipe ${ticket.equipe_id}`);
  return newCrise.id;
}