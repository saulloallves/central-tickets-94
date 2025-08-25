import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/hooks/useRole';
import { NotificationSounds } from '@/lib/notification-sounds';

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
    titulo: string | null;
    descricao_problema: string | null;
    codigo_ticket: string;
  } | null;
  // Dados da solicitação de acesso interno (quando aplicável)
  user_id?: string;
  equipe_id?: string;
  desired_role?: string;
  equipes?: {
    id: string;
    nome: string;
  };
  profiles?: {
    id: string;
    nome_completo: string;
    email: string;
  };
}

export const useInternalAlerts = () => {
  const [alerts, setAlerts] = useState<InternalAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { isAdmin, hasRole } = useRole();

  const fetchAlerts = async (status = 'pending') => {
    if (loading) return; // Prevent multiple simultaneous requests
    
    setLoading(true);
    try {
      // Construir query com joins para buscar dados relacionados de uma vez
      let query = supabase
        .from('notifications_queue')
        .select(`
          *,
          tickets!notifications_queue_ticket_id_fkey (
            id,
            titulo,
            descricao_problema,
            codigo_ticket
          )
        `)
        .eq('status', status)
        .not('alert_level', 'is', null);

      // Check user roles directly in the query using RLS instead of client-side filtering
      const { data: alertsData, error: alertsError } = await query
        .order('created_at', { ascending: false })
        .limit(20); // Reduce limit to improve performance

      if (alertsError) throw alertsError;

      // Process alerts with minimal additional queries
      const processedAlerts = (alertsData || []).map((alert): InternalAlert => {
        // Handle internal access request data from payload
        if (alert.type === 'internal_access_request') {
          const payload = alert.payload as any;
          return {
            id: alert.id,
            ticket_id: alert.ticket_id || '',
            type: alert.type,
            alert_level: alert.alert_level || 'normal',
            alert_category: alert.alert_category || undefined,
            payload: alert.payload,
            status: alert.status,
            created_at: alert.created_at,
            tickets: Array.isArray(alert.tickets) && alert.tickets.length > 0 ? alert.tickets[0] : null,
            user_id: payload?.user_id,
            equipe_id: payload?.equipe_id,
            desired_role: payload?.desired_role,
          };
        }
        
        return {
          id: alert.id,
          ticket_id: alert.ticket_id || '',
          type: alert.type,
          alert_level: alert.alert_level || 'normal', 
          alert_category: alert.alert_category || undefined,
          payload: alert.payload,
          status: alert.status,
          created_at: alert.created_at,
          tickets: Array.isArray(alert.tickets) && alert.tickets.length > 0 ? alert.tickets[0] : null,
        };
      });

      setAlerts(processedAlerts);
      console.log('Internal alerts fetched:', alertsData?.length);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      // Only show toast on user-triggered actions, not automatic refreshes
      if (status === 'pending') {
        toast({
          title: "Informação",
          description: "Carregando alertas...",
          variant: "default",
        });
      }
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
      
      // Refresh alerts list after a small delay to prevent rapid updates
      setTimeout(() => fetchAlerts(), 500);
      
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

      // Refresh alerts list after a small delay
      setTimeout(() => fetchAlerts(), 500);

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
          
          // Check if user should see this notification based on type
          if (newAlert.type === 'internal_access_request') {
            // Only admins and directors should see access requests and get notifications
            const userRoles = JSON.parse(localStorage.getItem('user-roles') || '[]');
            const isAdminOrDirector = userRoles.includes('admin') || userRoles.includes('diretoria');
            
            if (!isAdminOrDirector) {
              return; // Skip this notification
            }
            
            NotificationSounds.playNotificationSound('info');
            toast({
              title: "📝 Nova Solicitação de Acesso",
              description: "Um usuário solicitou acesso à equipe interna",
              variant: "default",
            });
          }
          // Show toast notification for critical alerts
          else if (newAlert.alert_level === 'critical') {
            NotificationSounds.playCriticalAlert(); // Multiple beeps for critical
            // Use ticket data from the payload instead of making another query
            const ticketTitle = newAlert.payload?.codigo_ticket || 'Ticket crítico';
            toast({
              title: "🚨 Alerta Crítico",
              description: `${newAlert.type} - ${ticketTitle}`,
              variant: "destructive",
            });
          }
          // Regular alerts
          else {
            let soundType: 'success' | 'warning' | 'critical' | 'info' = 'info';
            switch (newAlert.alert_level) {
              case 'critical':
                soundType = 'critical';
                break;
              case 'warning':
                soundType = 'warning';
                break;
              default:
                soundType = 'info';
            }
            NotificationSounds.playNotificationSound(soundType);
          }
          
          // Refresh alerts list with throttling to prevent rapid updates
          const refreshTimer = setTimeout(() => {
            fetchAlerts();
          }, 1000);
          
          // Clear any existing timer
          if ((window as any).alertRefreshTimer) {
            clearTimeout((window as any).alertRefreshTimer);
          }
          (window as any).alertRefreshTimer = refreshTimer;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      // Clean up timer
      if ((window as any).alertRefreshTimer) {
        clearTimeout((window as any).alertRefreshTimer);
      }
    };
  };

  useEffect(() => {
    // Request audio permission on first load
    NotificationSounds.requestAudioPermission();
    
    const initializeAlerts = async () => {
      await fetchAlerts();
    };
    
    initializeAlerts();
    const unsubscribe = setupRealtimeAlerts();
    
    return unsubscribe;
  }, []); // Remove dependencies to prevent infinite loops

  return {
    alerts,
    loading,
    fetchAlerts,
    createAlert,
    markAlertAsProcessed
  };
};