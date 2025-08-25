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
    titulo: string;
    descricao_problema: string;
    codigo_ticket: string;
  };
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
    setLoading(true);
    try {
      // Construir query base
      let query = supabase
        .from('notifications_queue')
        .select('*')
        .eq('status', status)
        .not('alert_level', 'is', null);

      // Filtrar alertas de solicitação de acesso apenas para admins
      if (!isAdmin && !hasRole('diretoria')) {
        query = query.neq('type', 'internal_access_request');
      }

      const { data: alertsData, error: alertsError } = await query
        .order('created_at', { ascending: false })
        .limit(50);

      if (alertsError) throw alertsError;

      // Buscar dados relacionados
      const enrichedAlerts = await Promise.all((alertsData || []).map(async (alert) => {
        let additionalData = null;

        // Se for uma notificação de solicitação de acesso interno
        if (alert.type === 'internal_access_request') {
          try {
            const payload = alert.payload as any;
            const requestId = payload?.request_id;
            
            if (requestId) {
              const { data: requestData } = await supabase
                .from('internal_access_requests')
                .select(`
                  *,
                  equipes:equipe_id (
                    id,
                    nome
                  ),
                  profiles:user_id (
                    id,
                    nome_completo,
                    email
                  )
                `)
                .eq('id', requestId)
                .single();
              
              additionalData = requestData;
            }
          } catch (error) {
            console.error('Error fetching access request data:', error);
          }
        }
        // Se for relacionado a ticket
        else if (alert.ticket_id) {
          try {
            const { data: ticketData } = await supabase
              .from('tickets')
              .select('id, titulo, descricao_problema, codigo_ticket')
              .eq('id', alert.ticket_id)
              .single();
            
            additionalData = { tickets: ticketData };
          } catch (error) {
            console.error('Error fetching ticket data:', error);
          }
        }

        return {
          ...alert,
          ...additionalData
        };
      }));

      setAlerts(enrichedAlerts as InternalAlert[]);
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
          
          // Determinar tipo de som baseado no nível do alerta
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
          
          // Notificação para solicitações de acesso interno (apenas para admins)
          if (newAlert.type === 'internal_access_request') {
            if (isAdmin || hasRole('diretoria')) {
              NotificationSounds.playNotificationSound('info');
              const alertPayload = newAlert.payload as any;
              toast({
                title: "📝 Nova Solicitação de Acesso",
                description: "Um usuário solicitou acesso à equipe interna",
                variant: "default",
              });
            }
          }
          // Show toast notification for critical alerts
          else if (newAlert.alert_level === 'critical') {
            NotificationSounds.playCriticalAlert(); // Multiple beeps for critical
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
          // Regular alerts
          else {
            NotificationSounds.playNotificationSound(soundType);
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
    // Request audio permission on first load
    NotificationSounds.requestAudioPermission();
    
    fetchAlerts();
    const unsubscribe = setupRealtimeAlerts();
    
    return unsubscribe;
  }, [isAdmin, hasRole]);

  return {
    alerts,
    loading,
    fetchAlerts,
    createAlert,
    markAlertAsProcessed
  };
};