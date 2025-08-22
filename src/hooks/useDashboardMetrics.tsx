import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface DashboardKPIs {
  total_tickets: number;
  tickets_resolvidos: number;
  tickets_abertos: number;
  tickets_sla_vencido: number;
  tickets_sla_ok: number;
  tickets_crise: number;
  tickets_reabertos: number;
  tempo_medio_resolucao: number;
  unidades_ativas: number;
  equipes_ativas: number;
  percentual_sla: number;
  percentual_resolucao: number;
  total_interacoes_ia: number;
  ia_usada_sucesso: number;
  tickets_com_ia: number;
  modelos_diferentes_usados: number;
  percentual_ia_sucesso: number;
  periodo_dias: number;
  data_calculo: string;
}

export interface TicketTrend {
  data: string;
  total_tickets: number;
  tickets_resolvidos: number;
  tickets_sla_ok: number;
  tempo_medio_resolucao: number;
}

export interface TeamMetrics {
  equipe_id: string;
  equipe_nome: string;
  total_tickets: number;
  tickets_resolvidos: number;
  tickets_sla_ok: number;
  tempo_medio_resolucao: number;
  tickets_crise: number;
  tickets_reabertos: number;
  unidades_atendidas: number;
}

export interface UnitMetrics {
  unidade_id: string;
  unidade_nome: string;
  total_tickets_mes: number;
  tickets_resolvidos: number;
  tickets_sla_ok: number;
  tickets_abertos: number;
  tickets_crise: number;
  tempo_medio_resolucao: number;
  interacoes_ia_total: number;
  ia_bem_sucedida: number;
  percentual_sla: number;
}

export const useDashboardMetrics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [trends, setTrends] = useState<TicketTrend[]>([]);
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics[]>([]);
  const [unitMetrics, setUnitMetrics] = useState<UnitMetrics[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKPIs = async (filters: {
    unidade_filter?: string;
    equipe_filter?: string;
    periodo_dias?: number;
  } = {}) => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_realtime_kpis', {
        p_user_id: user.id,
        p_unidade_filter: filters.unidade_filter || null,
        p_equipe_filter: filters.equipe_filter || null,
        p_periodo_dias: filters.periodo_dias || 30
      });

      if (error) throw error;

      setKpis(data as unknown as DashboardKPIs);
      console.log('KPIs fetched:', data);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os indicadores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async (filters: {
    dias?: number;
    unidade_filter?: string;
  } = {}) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_ticket_trends', {
        p_user_id: user.id,
        p_dias: filters.dias || 30,
        p_unidade_filter: filters.unidade_filter || null
      });

      if (error) throw error;

      setTrends(data || []);
      console.log('Trends fetched:', data?.length);
    } catch (error) {
      console.error('Error fetching trends:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as tendências",
        variant: "destructive",
      });
    }
  };

  const fetchTeamMetrics = async () => {
    try {
      // Since the view doesn't exist, create a simple placeholder
      setTeamMetrics([]);
      console.log('Team metrics placeholder loaded');
    } catch (error) {
      console.error('Error fetching team metrics:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar métricas das equipes",
        variant: "destructive",
      });
    }
  };

  const fetchUnitMetrics = async () => {
    try {
      // Since the view doesn't exist, create a simple placeholder
      setUnitMetrics([]);
      console.log('Unit metrics placeholder loaded');
    } catch (error) {
      console.error('Error fetching unit metrics:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar métricas das unidades",
        variant: "destructive",
      });
    }
  };

  const fetchTicketsByCategory = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('categoria')
        .not('categoria', 'is', null);

      if (error) throw error;

      // Group by category
      const categoryCounts = data.reduce((acc: Record<string, number>, ticket) => {
        const categoria = ticket.categoria || 'Sem Categoria';
        acc[categoria] = (acc[categoria] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(categoryCounts).map(([name, value]) => ({
        name,
        value
      }));
    } catch (error) {
      console.error('Error fetching tickets by category:', error);
      return [];
    }
  };

  const fetchTicketsByEquipe = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          equipe_responsavel_id,
          equipes!inner(nome)
        `)
        .not('equipe_responsavel_id', 'is', null);

      if (error) throw error;

      // Group by team
      const equipeCounts = data.reduce((acc: Record<string, number>, ticket) => {
        const equipeName = (ticket.equipes as any)?.nome || 'Sem Equipe';
        acc[equipeName] = (acc[equipeName] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(equipeCounts).map(([name, value]) => ({
        name,
        value
      }));
    } catch (error) {
      console.error('Error fetching tickets by team:', error);
      return [];
    }
  };

  const exportDashboardData = async (filters: any = {}) => {
    try {
      const data = {
        kpis,
        trends,
        teamMetrics,
        unitMetrics,
        filters,
        exportedAt: new Date().toISOString()
      };

      const csvContent = [
        // KPIs section
        'INDICADORES GERAIS',
        `Total de Tickets,${kpis?.total_tickets || 0}`,
        `Tickets Resolvidos,${kpis?.tickets_resolvidos || 0}`,
        `Tickets Abertos,${kpis?.tickets_abertos || 0}`,
        `Percentual SLA,${kpis?.percentual_sla || 0}%`,
        `Tempo Médio Resolução,${kpis?.tempo_medio_resolucao || 0} horas`,
        `Percentual IA Sucesso,${kpis?.percentual_ia_sucesso || 0}%`,
        '',
        // Team metrics section
        'MÉTRICAS POR EQUIPE',
        'Equipe,Total Tickets,Resolvidos,SLA OK,Tempo Médio',
        ...teamMetrics.map(team => 
          `${team.equipe_nome},${team.total_tickets},${team.tickets_resolvidos},${team.tickets_sla_ok},${team.tempo_medio_resolucao || 0}`
        ),
        '',
        // Unit metrics section
        'MÉTRICAS POR UNIDADE',
        'Unidade,Total Tickets,Resolvidos,SLA %,Tickets Crise',
        ...unitMetrics.map(unit => 
          `${unit.unidade_nome},${unit.total_tickets_mes},${unit.tickets_resolvidos},${unit.percentual_sla}%,${unit.tickets_crise}`
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `dashboard_metrics_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast({
        title: "Sucesso",
        description: "Dados do dashboard exportados com sucesso",
      });
    } catch (error) {
      console.error('Error exporting dashboard data:', error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar os dados",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchKPIs();
      fetchTrends();
      fetchTeamMetrics();
      fetchUnitMetrics();
    }
  }, [user]);

  return {
    kpis,
    trends,
    teamMetrics,
    unitMetrics,
    loading,
    fetchKPIs,
    fetchTrends,
    fetchTeamMetrics,
    fetchUnitMetrics,
    fetchTicketsByCategory,
    fetchTicketsByEquipe,
    exportDashboardData
  };
};