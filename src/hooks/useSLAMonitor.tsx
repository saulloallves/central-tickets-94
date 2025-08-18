
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  const checkSLAStatus = async () => {
    try {
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('id, codigo_ticket, data_limite_sla, sla_half_time, prioridade, status')
        .in('status', ['aberto', 'em_atendimento', 'escalonado'])
        .not('data_limite_sla', 'is', null);

      if (error) {
        console.error('Error fetching SLA data:', error);
        return;
      }

      const now = new Date();
      const alerts: SLAAlert[] = [];

      tickets.forEach(ticket => {
        const slaDeadline = new Date(ticket.data_limite_sla);
        const slaHalfTime = ticket.sla_half_time ? new Date(ticket.sla_half_time) : null;
        const minutesRemaining = Math.round((slaDeadline.getTime() - now.getTime()) / (1000 * 60));
        const isOverdue = minutesRemaining < 0;
        
        // Calcular porcentagem do SLA consumido
        let slaPercentage = 0;
        if (slaHalfTime) {
          const totalTime = slaDeadline.getTime() - (slaDeadline.getTime() - (slaHalfTime.getTime() * 2));
          const elapsedTime = now.getTime() - (slaDeadline.getTime() - totalTime);
          slaPercentage = Math.round((elapsedTime / totalTime) * 100);
        }

        // Alertar se SLA > 50% ou vencido
        if (slaPercentage >= 50 || isOverdue) {
          alerts.push({
            ticketId: ticket.id,
            codigo_ticket: ticket.codigo_ticket,
            sla_percentage: isOverdue ? 100 : slaPercentage,
            minutes_remaining: minutesRemaining,
            is_overdue: isOverdue,
            prioridade: ticket.prioridade
          });
        }
      });

      setSlaAlerts(alerts);

      // Mostrar toast para SLAs críticos
      const overdueCount = alerts.filter(a => a.is_overdue).length;
      const criticalCount = alerts.filter(a => !a.is_overdue && a.sla_percentage >= 80).length;

      if (overdueCount > 0) {
        toast({
          title: `🚨 ${overdueCount} SLA(s) Vencido(s)`,
          description: "Ação imediata necessária!",
          variant: "destructive",
        });
      } else if (criticalCount > 0) {
        toast({
          title: `⚠️ ${criticalCount} SLA(s) Crítico(s)`,
          description: "SLAs próximos do vencimento",
          variant: "destructive",
        });
      }

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
