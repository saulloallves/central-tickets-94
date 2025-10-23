// Using native Deno.serve (no import needed)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatisticsReport {
  data: {
    overview: any;
    sla_performance: any;
    priority_analysis: any;
    channel_analysis: any;
    team_performance: any[];
    unit_performance: any[];
    hourly_analysis: any[];
    delayed_tickets: any[];
    crisis_tickets: any[];
    attendant_performance: any[];
    escalations: any;
  };
  generated_at: string;
  period: {
    start: string;
    end: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get date range from query params (default to today)
  const body = await req.json();
  const startDate = body.start_date || new Date().toISOString().split('T')[0];
  const endDate = body.end_date || new Date().toISOString().split('T')[0];

    console.log(`📊 Gerando relatório estatístico: ${startDate} até ${endDate}`);

    const startDateTime = `${startDate}T00:00:00`;
    const endDateTime = `${endDate}T23:59:59`;

    // 1. VISÃO GERAL DO DIA
    const { data: allTickets } = await supabase
      .from('tickets')
      .select('*')
      .gte('data_abertura', startDateTime)
      .lte('data_abertura', endDateTime);

    const totalAbertos = allTickets?.length || 0;
    const totalConcluidos = allTickets?.filter(t => t.status === 'concluido').length || 0;
    const totalEmAndamento = allTickets?.filter(t => !['concluido', 'cancelado'].includes(t.status)).length || 0;
    const taxaConclusao = totalAbertos > 0 ? ((totalConcluidos / totalAbertos) * 100).toFixed(2) : '0.00';

    const overview = {
      total_abertos: totalAbertos,
      total_concluidos: totalConcluidos,
      total_em_andamento: totalEmAndamento,
      taxa_conclusao: `${taxaConclusao}%`,
    };

    // 2. DESEMPENHO DE SLA
    const ticketsDentroPrazo = allTickets?.filter(t => t.status_sla === 'dentro_prazo').length || 0;
    const ticketsVencidos = allTickets?.filter(t => t.status_sla === 'vencido').length || 0;
    const ticketsProximosVencer = allTickets?.filter(t => t.sla_half_time && new Date(t.sla_half_time) < new Date()).length || 0;
    
    const sla_performance = {
      tickets_dentro_prazo: ticketsDentroPrazo,
      tickets_vencidos: ticketsVencidos,
      tickets_proximos_vencer: ticketsProximosVencer,
      percentual_sla: totalAbertos > 0 ? ((ticketsDentroPrazo / totalAbertos) * 100).toFixed(2) + '%' : '0%',
    };

    // 3. ANÁLISE POR PRIORIDADE
    const prioridades = ['imediato', 'alto', 'medio', 'baixo', 'crise'];
    const priority_analysis = prioridades.map(p => {
      const tickets = allTickets?.filter(t => t.prioridade === p) || [];
      const concluidos = tickets.filter(t => t.status === 'concluido').length;
      return {
        prioridade: p,
        total: tickets.length,
        concluidos,
        taxa_resolucao: tickets.length > 0 ? ((concluidos / tickets.length) * 100).toFixed(2) + '%' : '0%',
      };
    });

    // 4. ANÁLISE POR CANAL
    const { data: ticketsCanal } = await supabase
      .from('tickets')
      .select('origem_canal')
      .gte('data_abertura', startDateTime)
      .lte('data_abertura', endDateTime);

    const canaisCount = ticketsCanal?.reduce((acc: any, t) => {
      const canal = t.origem_canal || 'nao_informado';
      acc[canal] = (acc[canal] || 0) + 1;
      return acc;
    }, {});

    const channel_analysis = Object.entries(canaisCount || {}).map(([canal, count]) => ({
      canal,
      total: count,
      percentual: totalAbertos > 0 ? (((count as number) / totalAbertos) * 100).toFixed(2) + '%' : '0%',
    }));

    // 6. DESEMPENHO POR EQUIPE
    const { data: equipes } = await supabase
      .from('equipes')
      .select('id, nome');

    const team_performance = await Promise.all(
      (equipes || []).map(async (equipe) => {
        const { data: teamTickets } = await supabase
          .from('tickets')
          .select('*')
          .eq('equipe_responsavel_id', equipe.id)
          .gte('data_abertura', startDateTime)
          .lte('data_abertura', endDateTime);

        const total = teamTickets?.length || 0;
        const resolvidos = teamTickets?.filter(t => t.status === 'concluido').length || 0;
        const atrasados = teamTickets?.filter(t => t.status_sla === 'vencido').length || 0;
        const slaOk = teamTickets?.filter(t => t.status_sla === 'dentro_prazo').length || 0;

        return {
          equipe: equipe.nome,
          total_tickets: total,
          resolvidos,
          em_andamento: total - resolvidos,
          atrasados,
          taxa_resolucao: total > 0 ? ((resolvidos / total) * 100).toFixed(2) + '%' : '0%',
          sla_ok: slaOk,
        };
      })
    );

    // 7. DESEMPENHO POR UNIDADE (apenas unidades com tickets no período)
    const { data: ticketsWithUnits } = await supabase
      .from('tickets')
      .select('unidade_id')
      .gte('data_abertura', startDateTime)
      .lte('data_abertura', endDateTime);

    // Extrair IDs únicos de unidades que tiveram tickets
    const uniqueUnidadeIds = [...new Set(ticketsWithUnits?.map(t => t.unidade_id).filter(id => id != null))];

    const unit_performance_raw = await Promise.all(
      uniqueUnidadeIds.map(async (unidadeId) => {
        // Buscar nome da unidade
        const { data: unidadeData } = await supabase
          .from('unidades')
          .select('id, grupo')
          .eq('id', unidadeId)
          .single();

        if (!unidadeData) return null;

        // Tickets criados no período
        const { data: unitTickets } = await supabase
          .from('tickets')
          .select('*')
          .eq('unidade_id', unidadeId)
          .gte('data_abertura', startDateTime)
          .lte('data_abertura', endDateTime);

        // Tickets em aberto (independente da data de criação)
        const { data: unitTicketsOpen } = await supabase
          .from('tickets')
          .select(`
            codigo_ticket,
            titulo,
            descricao_problema,
            status,
            prioridade,
            data_abertura,
            status_sla
          `)
          .eq('unidade_id', unidadeId)
          .not('status', 'in', '("concluido","cancelado")')
          .order('data_abertura', { ascending: false })
          .limit(10);

        const total = unitTickets?.length || 0;
        const resolvidos = unitTickets?.filter(t => t.status === 'concluido').length || 0;
        const atrasados = unitTickets?.filter(t => t.status_sla === 'vencido').length || 0;

        return {
          unidade: unidadeData.grupo,
          total_tickets: total,
          resolvidos,
          atrasados,
          taxa_resolucao: total > 0 ? ((resolvidos / total) * 100).toFixed(2) + '%' : '0%',
          tickets_em_aberto: unitTicketsOpen || [],
          total_abertos_atual: unitTicketsOpen?.length || 0,
        };
      })
    );

    // Filtrar valores null e ordenar por total de tickets (maior para menor)
    const unit_performance = unit_performance_raw
      .filter(u => u != null)
      .sort((a, b) => b!.total_tickets - a!.total_tickets);

    // 8. ANÁLISE HORÁRIA
    const hourly_analysis = Array.from({ length: 24 }, (_, hour) => {
      const ticketsHora = allTickets?.filter(t => {
        const hora = new Date(t.data_abertura).getHours();
        return hora === hour;
      }).length || 0;

      return {
        hora: `${hour.toString().padStart(2, '0')}:00`,
        tickets_abertos: ticketsHora,
      };
    });

    // 9. TICKETS ATRASADOS (DETALHADO)
    const { data: ticketsAtrasados } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades(grupo),
        equipes(nome),
        profiles(nome)
      `)
      .eq('status_sla', 'vencido')
      .gte('data_abertura', startDateTime)
      .lte('data_abertura', endDateTime)
      .order('data_abertura', { ascending: false });

    const delayed_tickets = (ticketsAtrasados || []).map(t => {
      const dataLimite = t.sla_expira_em ? new Date(t.sla_expira_em) : null;
      const horasAtrasadas = dataLimite ? Math.floor((new Date().getTime() - dataLimite.getTime()) / (1000 * 60 * 60)) : 0;

      return {
        codigo: t.codigo_ticket,
        titulo: t.titulo,
        descricao_problema: t.descricao_problema || 'Sem descrição',
        prioridade: t.prioridade,
        data_abertura: new Date(t.data_abertura).toLocaleString('pt-BR'),
        data_limite_sla: dataLimite?.toLocaleString('pt-BR') || 'N/A',
        horas_atrasadas: horasAtrasadas,
        equipe: t.equipes?.nome || 'Não atribuído',
        responsavel: t.profiles?.nome || 'Não atribuído',
        status: t.status,
        conversa_resumida: t.conversa ? `${(t.conversa as any[]).length} mensagens` : 'Sem conversa',
      };
    });

    // 10. TICKETS EM CRISE
    const { data: ticketsCrise } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades(grupo),
        equipes(nome)
      `)
      .eq('prioridade', 'crise')
      .gte('data_abertura', startDateTime)
      .lte('data_abertura', endDateTime)
      .order('data_abertura', { ascending: false });

    const crisis_tickets = (ticketsCrise || []).map(t => {
      const tempoDecorrido = Math.floor((new Date().getTime() - new Date(t.data_abertura).getTime()) / (1000 * 60 * 60));

      return {
        codigo: t.codigo_ticket,
        descricao: t.descricao_problema,
        data_abertura: new Date(t.data_abertura).toLocaleString('pt-BR'),
        tempo_decorrido_horas: tempoDecorrido,
        status: t.status,
        equipe: t.equipes?.nome || 'Não atribuído',
        unidade: t.unidades?.grupo || 'N/A',
      };
    });

    // 13. PERFORMANCE DE ATENDENTES
    const { data: atendentes } = await supabase
      .from('atendentes')
      .select('id, nome, status, ativo')
      .eq('ativo', true);

    const attendant_performance = await Promise.all(
      (atendentes || []).map(async (atendente) => {
        const { data: atdTickets, error: atdError } = await supabase
          .from('tickets')
          .select('*')
          .eq('responsavel_id', atendente.id)
          .gte('data_abertura', startDateTime)
          .lte('data_abertura', endDateTime);

        if (atdError) {
          console.error(`❌ Erro ao buscar tickets de ${atendente.nome}:`, atdError);
        }

        const total = atdTickets?.length || 0;
        const concluidos = atdTickets?.filter(t => t.status === 'concluido').length || 0;

        console.log(`📊 Atendente ${atendente.nome}: ${total} tickets (${concluidos} concluídos)`);

        return {
          atendente: atendente.nome,
          status_atendente: atendente.status,
          tickets_atendidos: total,
          concluidos,
          em_andamento: total - concluidos,
          taxa_resolucao: total > 0 ? ((concluidos / total) * 100).toFixed(2) + '%' : '0%',
        };
      })
    );
    
    console.log(`🔍 Performance de ${attendant_performance.length} atendentes calculada`);

    const report: StatisticsReport = {
      data: {
        overview,
        sla_performance,
        priority_analysis,
        channel_analysis,
        team_performance,
        unit_performance,
        hourly_analysis,
        delayed_tickets,
        crisis_tickets,
        attendant_performance,
      },
      generated_at: new Date().toISOString(),
      period: {
        start: startDateTime,
        end: endDateTime,
      },
    };

    console.log('✅ Relatório estatístico gerado com sucesso');

    return new Response(
      JSON.stringify(report),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao gerar relatório:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
