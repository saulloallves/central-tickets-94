import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TicketForAnalysis {
  id: string;
  codigo_ticket: string;
  descricao: string;
  categoria: string;
  prioridade: string;
  equipe_id: string;
  unidade_id: string;
  created_at: string;
  equipes?: { nome: string };
  unidades?: { grupo: string };
}

async function analyzeTicketSimilarity(tickets: TicketForAnalysis[]): Promise<any> {
  const prompt = `
Analise os seguintes tickets de suporte e identifique grupos de tickets que representam o mesmo problema:

${tickets.map(t => `
ID: ${t.id}
Código: ${t.codigo_ticket}
Descrição: ${t.descricao}
Categoria: ${t.categoria}
Equipe: ${t.equipes?.nome || 'N/A'}
Unidade: ${t.unidades?.grupo || 'N/A'}
---`).join('\n')}

Critérios para agrupar tickets:
1. Mesma equipe responsável
2. Problema similar (mesmo tipo de falha, erro ou questão)
3. Pelo menos 5 tickets no grupo

Retorne APENAS um JSON no formato:
{
  "grupos_crise": [
    {
      "titulo": "Nome do problema identificado",
      "descricao": "Descrição detalhada do problema comum",
      "palavras_chave": ["palavra1", "palavra2"],
      "tickets": ["id1", "id2", "id3", "id4", "id5"],
      "equipe_id": "id_da_equipe",
      "justificativa": "Por que estes tickets representam uma crise"
    }
  ]
}

Se não houver grupos com 5+ tickets similares, retorne: {"grupos_crise": []}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em análise de tickets de suporte. Retorne apenas JSON válido.' 
        },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing OpenAI response:', content);
    return { grupos_crise: [] };
  }
}

async function getTicketsForAnalysis(): Promise<TicketForAnalysis[]> {
  // Buscar tickets ativos das últimas 24 horas que não estão em crise
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select(`
      id,
      codigo_ticket,
      descricao,
      categoria,
      prioridade,
      equipe_id,
      unidade_id,
      created_at,
      equipes(nome),
      unidades(grupo)
    `)
    .in('status', ['aberto', 'em_andamento'])
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .is('crise_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }

  return tickets || [];
}

async function createAutomaticCrisis(group: any): Promise<string> {
  console.log('Creating automatic crisis for group:', group);

  const { data: crisis, error: crisisError } = await supabase
    .rpc('create_crisis_with_tickets', {
      p_titulo: group.titulo,
      p_descricao: group.descricao,
      p_palavras_chave: group.palavras_chave,
      p_ticket_ids: group.tickets,
      p_canal_oficial: 'AUTO_DETECTION',
      p_created_by: null // Sistema automático
    });

  if (crisisError) {
    console.error('Error creating crisis:', crisisError);
    throw crisisError;
  }

  // Log da detecção automática
  await supabase
    .from('system_logs')
    .insert({
      level: 'info',
      message: `Crise detectada automaticamente: ${group.titulo}`,
      details: {
        crisis_id: crisis,
        tickets_count: group.tickets.length,
        justificativa: group.justificativa,
        equipe_id: group.equipe_id
      },
      category: 'auto_crisis_detection'
    });

  return crisis;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== INICIANDO DETECÇÃO AUTOMÁTICA DE CRISES ===');

    // 1. Buscar tickets para análise
    const tickets = await getTicketsForAnalysis();
    console.log(`Analisando ${tickets.length} tickets`);

    if (tickets.length < 5) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Não há tickets suficientes para análise',
          tickets_analyzed: tickets.length 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Analisar similaridade com IA
    const analysis = await analyzeTicketSimilarity(tickets);
    console.log('Análise IA concluída:', analysis);

    const created_crises = [];

    // 3. Criar crises para grupos identificados
    for (const group of analysis.grupos_crise) {
      if (group.tickets && group.tickets.length >= 5) {
        try {
          const crisisId = await createAutomaticCrisis(group);
          created_crises.push({
            crisis_id: crisisId,
            titulo: group.titulo,
            tickets_count: group.tickets.length
          });
          console.log(`Crise criada: ${crisisId} com ${group.tickets.length} tickets`);
        } catch (error) {
          console.error('Error creating crisis for group:', group, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Detecção concluída. ${created_crises.length} crises criadas.`,
        tickets_analyzed: tickets.length,
        crises_created: created_crises,
        analysis_summary: analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-crisis-detection:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});