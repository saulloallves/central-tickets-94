import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserEquipes } from './useUserEquipes';
import { useToast } from '@/hooks/use-toast';

interface TeamMetrics {
  total_tickets: number;
  resolvidos_hoje: number;
  em_atendimento: number;
  abertos: number;
  escalonados: number;
  tickets_proximos_vencer: any[];
  carga_por_colaborador: any[];
}

interface CrisisMetrics {
  crise_ativa: boolean;
  tickets_criticos_equipe: number;
  backlog_ultimos_7_dias: number;
}

export const useTeamDashboardMetrics = () => {
  const { user } = useAuth();
  const { userEquipes, getPrimaryEquipe } = useUserEquipes();
  const { toast } = useToast();
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics | null>(null);
  const [crisisMetrics, setCrisisMetrics] = useState<CrisisMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeamMetrics = async () => {
    const primaryEquipe = getPrimaryEquipe();
    if (!primaryEquipe) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = `${today}T00:00:00.000Z`;
      const endOfDay = `${today}T23:59:59.999Z`;

      // Métricas da equipe
      const { data: teamTickets } = await supabase
        .from('tickets')
        .select(`
          id, 
          status, 
          prioridade,
          data_abertura,
          data_limite_sla,
          resolvido_em,
          updated_at,
          colaborador_id,
          colaboradores(nome_completo)
        `)
        .eq('equipe_responsavel_id', primaryEquipe.equipe_id);

      if (teamTickets) {
        const total_tickets = teamTickets.length;
        const abertos = teamTickets.filter(t => t.status === 'aberto').length;
        const em_atendimento = teamTickets.filter(t => t.status === 'em_atendimento').length;
        const escalonados = teamTickets.filter(t => t.status === 'escalonado').length;
        
        // Tickets resolvidos hoje (status concluído + updated_at de hoje)
        const resolvidos_hoje = teamTickets.filter(t => 
          t.status === 'concluido' && 
          t.updated_at && 
          t.updated_at >= startOfDay && 
          t.updated_at <= endOfDay
        ).length;

        // Tickets próximos de vencer SLA (próximas 2 horas)
        const now = new Date();
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        
        const tickets_proximos_vencer = teamTickets
          .filter(t => 
            t.data_limite_sla && 
            new Date(t.data_limite_sla) <= twoHoursFromNow &&
            new Date(t.data_limite_sla) > now &&
            ['aberto', 'em_atendimento'].includes(t.status)
          )
          .slice(0, 5); // Máximo 5

        // Carga por colaborador (tickets em atendimento)
        const colaboradorMap = new Map();
        teamTickets
          .filter(t => t.status === 'em_atendimento' && t.colaborador_id)
          .forEach(ticket => {
            const nome = ticket.colaboradores?.nome_completo || 'Desconhecido';
            const current = colaboradorMap.get(nome) || 0;
            colaboradorMap.set(nome, current + 1);
          });

        const carga_por_colaborador = Array.from(colaboradorMap.entries())
          .map(([nome, count]) => ({ nome, tickets: count }))
          .sort((a, b) => b.tickets - a.tickets)
          .slice(0, 5); // Top 5

        setTeamMetrics({
          total_tickets,
          resolvidos_hoje,
          em_atendimento,
          abertos,
          escalonados,
          tickets_proximos_vencer,
          carga_por_colaborador
        });
      }
    } catch (error) {
      console.error('Error fetching team metrics:', error);
    }
  };

  const fetchCrisisMetrics = async () => {
    try {
      // Verificar se há crise ativa E recente (últimas 24 horas)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: criseAtiva, error: criseError } = await supabase
        .from('crises')
        .select('id, status, is_active, created_at')
        .eq('is_active', true)
        .in('status', ['aberto', 'investigando', 'comunicado', 'mitigado'])
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .limit(1);

      console.log('🚨 Crisis check (recent only):', { criseAtiva, criseError });

      const primaryEquipe = getPrimaryEquipe();
      let tickets_criticos_equipe = 0;

      if (primaryEquipe) {
        // Tickets críticos da equipe
        const { data: criticalTickets } = await supabase
          .from('tickets')
          .select('id')
          .eq('equipe_responsavel_id', primaryEquipe.equipe_id)
          .in('prioridade', ['crise', 'imediato'])
          .in('status', ['aberto', 'em_atendimento', 'escalonado']);

        tickets_criticos_equipe = criticalTickets?.length || 0;
      }

      // Backlog últimos 7 dias
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: backlogTickets } = await supabase
        .from('tickets')
        .select('id')
        .gte('data_abertura', sevenDaysAgo.toISOString())
        .eq('status', 'aberto');

      // Só considera crise ativa se for recente (últimas 24h) e realmente ativa
      const isCrisisActive = !criseError && criseAtiva && criseAtiva.length > 0;
      console.log('🚨 Is crisis active (recent only):', isCrisisActive);

      setCrisisMetrics({
        crise_ativa: isCrisisActive,
        tickets_criticos_equipe,
        backlog_ultimos_7_dias: backlogTickets?.length || 0
      });

    } catch (error) {
      console.error('Error fetching crisis metrics:', error);
      // Em caso de erro, não mostrar crise ativa
      setCrisisMetrics(prev => prev ? { ...prev, crise_ativa: false } : null);
    }
  };

  const fetchAllMetrics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTeamMetrics(),
        fetchCrisisMetrics()
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && userEquipes.length > 0) {
      fetchAllMetrics();
    }
  }, [user, userEquipes]);

  return {
    teamMetrics,
    crisisMetrics,
    loading,
    primaryEquipe: getPrimaryEquipe(),
    refetch: fetchAllMetrics
  };
};