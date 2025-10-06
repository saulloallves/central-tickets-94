
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  const [filters, setFilters] = useState<{ unidade_id?: string; periodo_dias?: number }>({});

  // ✅ OTIMIZAÇÃO: Migrado para React Query com staleTime
  const { data: teamMetrics = [], isLoading: loading, refetch, error } = useQuery({
    queryKey: ['team-metrics', user?.id, filters],
    staleTime: 2 * 60 * 1000, // ✅ Cache de 2 minutos
    gcTime: 5 * 60 * 1000, // ✅ Garbage collect após 5 minutos
    retry: 1, // ✅ Apenas 1 retry para evitar múltiplas tentativas
    queryFn: async () => {
      if (!user) return [];

      console.log('👥 [TEAM METRICS] Starting fetch with names for user:', user.id);
      
      try {
        // First get team metrics using the existing RPC
        const { data: metricsData, error: metricsError } = await supabase.rpc('get_team_metrics', {
          p_user_id: user.id,
          p_periodo_dias: filters?.periodo_dias ?? 30,
          p_unidade_filter: filters?.unidade_id || null
        });

        if (metricsError) {
          console.error('❌ [TEAM METRICS] Error fetching metrics:', metricsError);
          // ✅ NÃO mostrar toast aqui - deixar componentes decidirem
          throw metricsError;
        }

        // Now get team names
        const { data: teamsData, error: teamsError } = await supabase
          .from('equipes')
          .select('id, nome')
          .eq('ativo', true);

        if (teamsError) {
          console.error('❌ [TEAM METRICS] Error fetching team names:', teamsError);
          return (metricsData || []).map((metric: any) => ({
            ...metric,
            equipe_nome: metric.equipe_nome || 'Sem Equipe'
          }));
        }

        console.log('📊 [TEAM METRICS] Metrics data:', metricsData);
        console.log('👥 [TEAM METRICS] Teams data:', teamsData);

        // Map team IDs to names
        const teamNamesMap = teamsData.reduce((acc: Record<string, string>, team) => {
          acc[team.id] = team.nome;
          return acc;
        }, {});

        // Combine metrics with team names
        const enrichedMetrics = (metricsData || []).map((metric: any) => ({
          ...metric,
          equipe_nome: teamNamesMap[metric.equipe_id] ?? metric.equipe_nome ?? 'Sem Equipe'
        }));

        console.log('✅ [TEAM METRICS] Enriched metrics:', enrichedMetrics);
        return enrichedMetrics;
        
      } catch (error) {
        console.error('💥 [TEAM METRICS] Unexpected error:', error);
        // ✅ NÃO mostrar toast aqui - deixar componentes decidirem
        throw error;
      }
    },
    enabled: !!user,
  });

  const fetchTeamMetricsWithNames = async (newFilters?: { unidade_id?: string; periodo_dias?: number }) => {
    if (newFilters) {
      setFilters(newFilters);
    }
    await refetch();
  };

  return {
    teamMetrics,
    loading,
    error,
    fetchTeamMetricsWithNames,
    refetch: () => fetchTeamMetricsWithNames(filters)
  };
};
