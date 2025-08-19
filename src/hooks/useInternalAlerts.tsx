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
}

export const useInternalAlerts = () => {
  const [alerts, setAlerts] = useState<InternalAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAlerts = async (status = 'pending') => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications_queue')
        .select('*')
        .eq('status', status)
        .not('alert_level', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setAlerts(data || []);
      console.log('Internal alerts fetched:', data?.length);
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
            toast({
              title: "🚨 Alerta Crítico",
              description: `${newAlert.type} - Ticket ${newAlert.ticket_id}`,
              variant: "destructive",
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