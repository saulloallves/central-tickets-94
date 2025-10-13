
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateTimeRemaining } from '@/lib/date-utils';

export interface SLAAlert {
  ticketId: string;
  codigo_ticket: string;
  sla_percentage: number;
  minutes_remaining: number;
  is_overdue: boolean;
  prioridade: string;
}

export const useSLAMonitor = () => {
  const [slaAlerts, setSlaAlerts] = useState<SLAAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const checkSLAStatus = async () => {
    try {
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('id, codigo_ticket, data_limite_sla, sla_half_time, prioridade, status, data_abertura, sla_pausado, sla_pausado_em, tempo_pausado_total')
        .in('status', ['aberto', 'em_atendimento', 'escalonado'])
        .not('data_limite_sla', 'is', null);

      if (error) {
        console.error('Error fetching SLA data:', error);
        return;
      }

      const now = new Date();
      const alerts: SLAAlert[] = [];

      tickets.forEach(ticket => {
        const timeRemaining = calculateTimeRemaining(ticket.data_limite_sla);
        
        // Calcular porcentagem do SLA consumido baseado no tempo total
        const totalSlaMs = new Date(ticket.data_limite_sla).getTime() - new Date(ticket.data_abertura).getTime();
        const elapsedMs = new Date().getTime() - new Date(ticket.data_abertura).getTime();
        const slaPercentage = Math.min(100, Math.max(0, (elapsedMs / totalSlaMs) * 100));

        // Alertar se SLA > 50% ou vencido
        if (slaPercentage >= 50 || timeRemaining.isOverdue) {
          alerts.push({
            ticketId: ticket.id,
            codigo_ticket: ticket.codigo_ticket,
            sla_percentage: timeRemaining.isOverdue ? 100 : Math.round(slaPercentage),
            minutes_remaining: timeRemaining.minutes,
            is_overdue: timeRemaining.isOverdue,
            prioridade: ticket.prioridade
          });
        }
      });

      setSlaAlerts(alerts);

    } catch (error) {
      console.error('Error checking SLA status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSLAStatus();
    
    // Verificar SLAs a cada 2 minutos
    const interval = setInterval(checkSLAStatus, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    slaAlerts,
    loading,
    refreshSLA: checkSLAStatus
  };
};
