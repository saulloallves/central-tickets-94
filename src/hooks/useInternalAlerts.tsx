import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InternalAlert {
  id: string;
  ticket_id: string;
  type: string;
  alert_level: string;
  alert_category?: string;
  payload: any;
  status: string;
  created_at: string;
  tickets?: {
    id: string;
    titulo: string;
    descricao_problema: string;
    codigo_ticket: string;
  };
}

export const useInternalAlerts = () => {
  const [alerts, setAlerts] = useState<InternalAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAlerts = async (status = 'pending') => {
    setLoading(true);
    try {
      // Buscar alertas
      const { data: alertsData, error: alertsError } = await supabase
        .from('notifications_queue')
        .select('*')
        .eq('status', status)
        .not('alert_level', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (alertsError) throw alertsError;

      // Buscar tickets relacionados
      const ticketIds = alertsData?.map(alert => alert.ticket_id) || [];
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, titulo, descricao_problema, codigo_ticket')
        .in('id', ticketIds);

      if (ticketsError) throw ticketsError;

      // Combinar dados
      const alertsWithTickets = alertsData?.map(alert => ({
        ...alert,
        tickets: ticketsData?.find(ticket => ticket.id === alert.ticket_id)
      })) || [];

      setAlerts(alertsWithTickets as InternalAlert[]);
      console.log('Internal alerts fetched:', alertsData?.length);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os alertas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async (
    ticketId: string,
    alertType: string,
    alertLevel: 'normal' | 'warning' | 'critical' = 'normal',
    alertCategory?: string,
    payload: any = {}
  ) => {
    try {
      const { data, error } = await supabase.rpc('create_internal_alert', {
        p_ticket_id: ticketId,
        p_alert_type: alertType,
        p_alert_level: alertLevel,
        p_alert_category: alertCategory,
        p_payload: payload
      });

      if (error) throw error;

      console.log('Internal alert created:', data);
      
      // Refresh alerts list
      await fetchAlerts();
      
      return data;
    } catch (error) {
      console.error('Error creating alert:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o alerta",
        variant: "destructive",
      });
      throw error;
    }
  };

  const markAlertAsProcessed = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('notifications_queue')
        .update({ 
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      // Refresh alerts list
      await fetchAlerts();

      toast({
        title: "Sucesso",
        description: "Alerta marcado como processado",
      });
    } catch (error) {
      console.error('Error marking alert as processed:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o alerta",
        variant: "destructive",
      });
    }
  };

  const setupRealtimeAlerts = () => {
    const channel = supabase
      .channel('internal-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications_queue',
          filter: 'alert_level=neq.null'
        },
        (payload) => {
          console.log('New internal alert received:', payload.new);
          const newAlert = payload.new as InternalAlert;
          
          // Show toast notification for critical alerts
          if (newAlert.alert_level === 'critical') {
            // Buscar dados do ticket para a notificação
            supabase
              .from('tickets')
              .select('titulo, descricao_problema')
              .eq('id', newAlert.ticket_id)
              .single()
              .then(({ data: ticket }) => {
                const ticketTitle = ticket?.titulo || ticket?.descricao_problema || 'Ticket sem título';
                toast({
                  title: "🚨 Alerta Crítico",
                  description: `${newAlert.type} - ${ticketTitle}`,
                  variant: "destructive",
                });
              });
          }
          
          // Refresh alerts list
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    fetchAlerts();
    const unsubscribe = setupRealtimeAlerts();
    
    return unsubscribe;
  }, []);

  return {
    alerts,
    loading,
    fetchAlerts,
    createAlert,
    markAlertAsProcessed
  };
};