import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserEquipes } from './useUserEquipes';
import { useToast } from '@/hooks/use-toast';

interface PersonalMetrics {
  meus_tickets_abertos: number;
  meus_tickets_em_atendimento: number;
  meus_tickets_por_prioridade: {
    critico: number;
    alto: number;
    medio: number;
  };
}

interface TeamMetrics {
  fila_equipe: number;
  resolvidos_hoje: number;
  total_abertos: number;
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
  const [personalMetrics, setPersonalMetrics] = useState<PersonalMetrics | null>(null);
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics | null>(null);
  const [crisisMetrics, setCrisisMetrics] = useState<CrisisMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPersonalMetrics = async () => {
    if (!user) return;

    try {
      // Buscar meus tickets do colaborador logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile?.email) return;

      const { data: colaborador } = await supabase
        .from('colaboradores')
        .select('id')
        .eq('email', profile.email)
        .single();

      if (!colaborador) return;

      const today = new Date().toISOString().split('T')[0];

      // Meus tickets abertos e em atendimento
      const { data: myTickets } = await supabase
        .from('tickets')
        .select('id, status, prioridade')
        .eq('colaborador_id', colaborador.id)
        .in('status', ['aberto', 'em_atendimento'])
        .gte('data_abertura', today);

      if (myTickets) {
        const abertos = myTickets.filter(t => t.status === 'aberto').length;
        const em_atendimento = myTickets.filter(t => t.status === 'em_atendimento').length;
        
        // Contar por prioridade (usando nova nomenclatura)
        const critico = myTickets.filter(t => 
          t.prioridade === 'crise' || t.prioridade === 'imediato'
        ).length;
        const alto = myTickets.filter(t => t.prioridade === 'ate_1_hora').length;
        const medio = myTickets.filter(t => 
          t.prioridade === 'ainda_hoje' || t.prioridade === 'posso_esperar'
        ).length;

        setPersonalMetrics({
          meus_tickets_abertos: abertos,
          meus_tickets_em_atendimento: em_atendimento,
          meus_tickets_por_prioridade: {
            critico,
            alto,
            medio
          }
        });
      }
    } catch (error) {
      console.error('Error fetching personal metrics:', error);
    }
  };

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
          colaborador_id,
          colaboradores(nome_completo)
        `)
        .eq('equipe_responsavel_id', primaryEquipe.equipe_id);

      if (teamTickets) {
        const fila_equipe = teamTickets.filter(t => t.status === 'aberto').length;
        
        const resolvidos_hoje = teamTickets.filter(t => 
          t.resolvido_em && 
          t.resolvido_em >= startOfDay && 
          t.resolvido_em <= endOfDay
        ).length;

        const total_abertos = teamTickets.filter(t => 
          ['aberto', 'em_atendimento', 'escalonado'].includes(t.status)
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
          fila_equipe,
          resolvidos_hoje,
          total_abertos,
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
      // Verificar se há crise ativa
      const { data: criseAtiva } = await supabase
        .from('crises')
        .select('id')
        .eq('status', 'aberto')
        .eq('is_active', true)
        .limit(1);

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

      setCrisisMetrics({
        crise_ativa: (criseAtiva?.length || 0) > 0,
        tickets_criticos_equipe,
        backlog_ultimos_7_dias: backlogTickets?.length || 0
      });

    } catch (error) {
      console.error('Error fetching crisis metrics:', error);
    }
  };

  const fetchAllMetrics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPersonalMetrics(),
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
    personalMetrics,
    teamMetrics,
    crisisMetrics,
    loading,
    primaryEquipe: getPrimaryEquipe(),
    refetch: fetchAllMetrics
  };
};