
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface TeamMetricsWithNames {
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

export const useTeamMetrics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teamMetrics, setTeamMetrics] = useState<TeamMetricsWithNames[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTeamMetricsWithNames = async (filters?: { unidade_id?: string; periodo_dias?: number }) => {
    if (!user) return;

    console.log('👥 [TEAM METRICS] Starting fetch with names for user:', user.id);
    setLoading(true);
    
    try {
      // First get team metrics using the existing RPC
      const { data: metricsData, error: metricsError } = await supabase.rpc('get_team_metrics', {
        p_user_id: user.id,
        p_periodo_dias: filters?.periodo_dias || 30,
        p_unidade_filter: filters?.unidade_id || null
      });

      if (metricsError) {
        console.error('❌ [TEAM METRICS] Error fetching metrics:', metricsError);
        setTeamMetrics([]);
        toast({
          title: "Erro",
          description: "Não foi possível carregar métricas das equipes",
          variant: "destructive",
        });
        return;
      }

      // Now get team names
      const { data: teamsData, error: teamsError } = await supabase
        .from('equipes')
        .select('id, nome')
        .eq('ativo', true);

      if (teamsError) {
        console.error('❌ [TEAM METRICS] Error fetching team names:', teamsError);
        // Still proceed with IDs if we can't get names
        setTeamMetrics(metricsData || []);
        return;
      }

      console.log('📊 [TEAM METRICS] Metrics data:', metricsData);
      console.log('👥 [TEAM METRICS] Teams data:', teamsData);

      // Map team IDs to names
      const teamNamesMap = teamsData.reduce((acc: Record<string, string>, team) => {
        acc[team.id] = team.nome;
        return acc;
      }, {});

      // Combine metrics with team names - preserve RPC-returned name if available
      const enrichedMetrics = (metricsData || []).map((metric: any) => ({
        ...metric,
        equipe_nome: teamNamesMap[metric.equipe_id] ?? metric.equipe_nome ?? 'Sem Equipe'
      }));

      console.log('✅ [TEAM METRICS] Enriched metrics:', enrichedMetrics);
      setTeamMetrics(enrichedMetrics);
      
    } catch (error) {
      console.error('💥 [TEAM METRICS] Unexpected error:', error);
      setTeamMetrics([]);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar métricas das equipes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTeamMetricsWithNames();
    }
  }, [user]);

  return {
    teamMetrics,
    loading,
    fetchTeamMetricsWithNames,
    refetch: fetchTeamMetricsWithNames
  };
};
