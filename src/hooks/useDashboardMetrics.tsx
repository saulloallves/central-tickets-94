import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  total_tickets?: number;
  tickets_resolvidos: number;
  tickets_sla_ok: number;
  tempo_medio_resolucao: number;
}

export interface TeamMetrics {
  equipe_id: string;
  equipe_nome: string;
  total_tickets: number;
  tickets_resolvidos: number;
  tickets_em_aberto: number;
  taxa_resolucao: number;
  tempo_medio_resolucao: number;
  tickets_sla_ok?: number;
  tickets_crise?: number;
  tickets_reabertos?: number;
  unidades_atendidas?: number;
}

export interface UnitMetrics {
  unidade_id: string;
  unidade_nome: string;
  total_tickets_mes: number;
  tickets_resolvidos: number;
  tickets_abertos: number;
  percentual_sla: number;
  tempo_medio_resolucao: number;
  tickets_crise: number;
  ia_bem_sucedida: number;
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
  } = {}, showToast: boolean = false) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_realtime_kpis', {
        p_user_id: user.id,
        p_unidade_filter: filters.unidade_filter || null,
        p_equipe_filter: filters.equipe_filter || null,
        p_periodo_dias: filters.periodo_dias ?? 30  // Use 30 as default instead of 0
      });

      if (error) throw error;

      console.log('🎯 [KPIs] Raw data from Supabase:', data);
      
      // The RPC function returns JSONB, so we need to parse it correctly
      const kpisData = typeof data === 'object' ? data : JSON.parse(String(data));
      
      setKpis(kpisData as DashboardKPIs);
      console.log('✅ [KPIs] Processed KPIs:', kpisData);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      // Only show toast if explicitly requested
      if (showToast) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os indicadores",
          variant: "destructive",
        });
      }
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
        p_dias: filters.dias || 0,
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

  const fetchTeamMetrics = async (filters?: { unidade_id?: string; periodo_dias?: number }) => {
    try {
      const { data, error } = await supabase.rpc('get_team_metrics', {
        p_user_id: user?.id,
        p_periodo_dias: filters?.periodo_dias ?? 30,  // Use 30 as default instead of 0
        p_unidade_filter: filters?.unidade_id || null
      });

      if (error) {
        console.error('Error fetching team metrics:', error);
        setTeamMetrics([]);
        toast({
          title: "Informação",
          description: "Métricas das equipes não estão disponíveis no momento.",
          variant: "default",
        });
        return;
      }

      setTeamMetrics(data || []);
      console.log('Team metrics loaded:', data?.length);
    } catch (error) {
      console.error('Error fetching team metrics:', error);
      setTeamMetrics([]);
      toast({
        title: "Informação",
        description: "Métricas das equipes não estão disponíveis no momento.",
        variant: "default",
      });
    }
  };

  const fetchUnitMetrics = async (filters?: { equipe_id?: string; periodo_dias?: number }, showToast: boolean = false) => {
    console.log('🏢 [UNIT METRICS] Starting fetch with filters:', filters);
    console.log('🔑 [UNIT METRICS] User ID:', user?.id);
    
    try {
      const { data, error } = await supabase.rpc('get_unit_metrics', {
        p_user_id: user?.id,
        p_periodo_dias: filters?.periodo_dias ?? 30,  // Use 30 as default instead of 0
        p_equipe_filter: filters?.equipe_id || null
      });

      console.log('📊 [UNIT METRICS] Raw response from Supabase:', { data, error });

      if (error) {
        console.error('❌ [UNIT METRICS] Supabase error:', error);
        setUnitMetrics([]);
        // Only show toast if explicitly requested
        if (showToast) {
          toast({
            title: "Erro",
            description: `Erro ao carregar métricas das unidades: ${error.message}`,
            variant: "destructive",
          });
        }
        return;
      }

      console.log('✅ [UNIT METRICS] Data received:', data);
      console.log('📈 [UNIT METRICS] Number of units:', data?.length || 0);
      
      if (data && data.length > 0) {
        console.log('🔍 [UNIT METRICS] First unit sample:', data[0]);
      }

      // ✅ OTIMIZAÇÃO: Cache de nomes de unidades para evitar queries repetidas
      const unitIds = (data || []).map((unit: any) => unit.unidade_id).filter(Boolean);
      
      let unitNamesMap: Record<string, string> = {};
      if (unitIds.length > 0) {
        // Cache key para nomes de unidades
        const cachedNames = sessionStorage.getItem('unit-names-cache');
        const cacheTimestamp = sessionStorage.getItem('unit-names-cache-timestamp');
        
        // Usar cache se tiver menos de 5 minutos
        if (cachedNames && cacheTimestamp && (Date.now() - parseInt(cacheTimestamp)) < 5 * 60 * 1000) {
          unitNamesMap = JSON.parse(cachedNames);
          console.log('📦 [UNIT METRICS] Usando cache de nomes de unidades');
        } else {
          const { data: unidadesData } = await supabase
            .from('unidades')
            .select('id, grupo')
            .in('id', unitIds);
          
          if (unidadesData) {
            unitNamesMap = unidadesData.reduce((acc, u) => {
              acc[u.id] = u.grupo || u.id;
              return acc;
            }, {} as Record<string, string>);
            
            // Salvar no cache
            sessionStorage.setItem('unit-names-cache', JSON.stringify(unitNamesMap));
            sessionStorage.setItem('unit-names-cache-timestamp', Date.now().toString());
            console.log('💾 [UNIT METRICS] Cache de nomes de unidades atualizado');
          }
        }
      }

      // Map the database response to match our interface
      const mappedData = (data || []).map((unit: any) => ({
        unidade_id: unit.unidade_id,
        unidade_nome: unit.unidade_nome || unitNamesMap[unit.unidade_id] || unit.unidade_id,
        total_tickets_mes: unit.total_tickets_mes || 0,
        tickets_resolvidos: unit.tickets_resolvidos || 0,
        tickets_abertos: unit.tickets_abertos || 0,
        percentual_sla: unit.percentual_sla || 0,
        tempo_medio_resolucao: unit.tempo_medio_resolucao || 0,
        tickets_crise: unit.tickets_crise || 0,
        ia_bem_sucedida: unit.ia_bem_sucedida || 0
      }));

      setUnitMetrics(mappedData);
      console.log('💾 [UNIT METRICS] State updated with', mappedData.length, 'units');
    } catch (error) {
      console.error('💥 [UNIT METRICS] Unexpected error:', error);
      setUnitMetrics([]);
      // Only show toast if explicitly requested during initial load
      if (showToast) {
        toast({
          title: "Erro",
          description: "Erro inesperado ao carregar métricas das unidades.",
          variant: "destructive",
        });
      }
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

      // Group by team name instead of ID
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

  // No longer auto-load on mount - let components fetch when needed
  // This prevents multiple simultaneous loads and redundant error toasts

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
