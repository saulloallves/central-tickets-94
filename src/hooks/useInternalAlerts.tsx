import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/hooks/useAuth';
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
  const { user } = useAuth();
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
    console.log('🔄 Tentando marcar alerta como lido:', alertId);
    try {
      const { data, error } = await supabase
        .from('notifications_queue')
        .update({ 
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', alertId);

      console.log('✅ Resultado da atualização:', { data, error });

      if (error) {
        console.error('❌ Erro na atualização:', error);
        throw error;
      }

      console.log('🔄 Atualizando lista de alertas...');
      // Refresh alerts list after a small delay
      setTimeout(() => fetchAlerts(), 500);

      toast({
        title: "Sucesso",
        description: "Alerta marcado como processado",
      });
    } catch (error) {
      console.error('❌ Error marking alert as processed:', error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o alerta. Verifique as permissões.",
        variant: "destructive",
      });
    }
  };

  const setupRealtimeAlerts = async () => {
    // Buscar as equipes do usuário para filtrar notificações
    let userEquipeIds: string[] = [];
    
    if (user?.id) {
      try {
        const { data: userEquipes } = await supabase
          .from('equipe_members')
          .select('equipe_id')
          .eq('user_id', user.id)
          .eq('ativo', true);
        
        userEquipeIds = userEquipes?.map(eq => eq.equipe_id) || [];
        console.log('User equipes for notifications:', userEquipeIds);
      } catch (error) {
        console.error('Error fetching user equipes for notifications:', error);
      }
    }

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
        async (payload) => {
          console.log('New internal alert received:', payload.new);
          const newAlert = payload.new as InternalAlert;
          
          // Filtrar por equipe se o alerta tem ticket_id
          if (newAlert.ticket_id && userEquipeIds.length > 0) {
            try {
              const { data: ticketData } = await supabase
                .from('tickets')
                .select(`
                  equipe_responsavel_id, 
                  codigo_ticket, 
                  unidade_id,
                  equipes:equipe_responsavel_id (
                    nome
                  )
                `)
                .eq('id', newAlert.ticket_id)
                .single();
              
              if (ticketData?.equipe_responsavel_id && !userEquipeIds.includes(ticketData.equipe_responsavel_id)) {
                console.log(`🔇 Notification filtered: User not in equipe ${ticketData.equipe_responsavel_id}`);
                return; // Usuário não faz parte da equipe responsável
              }
              
              // Adicionar dados do ticket ao payload para exibir informações mais detalhadas
              newAlert.payload = {
                ...newAlert.payload,
                codigo_ticket: ticketData?.codigo_ticket,
                unidade_id: ticketData?.unidade_id,
                equipe_nome: (ticketData?.equipes as any)?.nome
              };
            } catch (error) {
              console.error('Error checking ticket equipe:', error);
              // Em caso de erro, continua com a notificação
            }
          }
          
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
          // Regular alerts - incluindo ticket_created, sla_half, sla_breach, etc.
          else {
            let soundType: 'success' | 'warning' | 'critical' | 'info' = 'info';
            let title = "";
            let description = "";
            
            const equipeInfo = newAlert.payload?.equipe_nome ? ` [${newAlert.payload.equipe_nome}]` : '';
            
            switch (newAlert.type) {
              case 'ticket_created':
                soundType = 'info';
                title = "🎫 Novo Ticket";
                description = `Ticket ${newAlert.payload?.codigo_ticket || ''}${equipeInfo} foi criado`;
                break;
              case 'sla_half':
                soundType = 'warning';
                title = "⏰ SLA 50%";
                description = `Ticket ${newAlert.payload?.codigo_ticket || ''}${equipeInfo} atingiu 50% do prazo`;
                break;
              case 'sla_breach':
                soundType = 'critical';
                title = "🚨 SLA Vencido";
                description = `Ticket ${newAlert.payload?.codigo_ticket || ''}${equipeInfo} está vencido`;
                break;
              case 'crisis':
                soundType = 'critical';
                title = "🔥 Crise Detectada";
                description = `Ticket ${newAlert.payload?.codigo_ticket || ''}${equipeInfo} em crise`;
                break;
              default:
                soundType = 'info';
                title = "🔔 Notificação";
                description = newAlert.type;
            }
            
            NotificationSounds.playNotificationSound(soundType);
            toast({
              title,
              description,
              variant: newAlert.alert_level === 'critical' ? "destructive" : "default",
            });
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
    const sessionKey = 'internal_alerts_initialized';
    const wasInitialized = sessionStorage.getItem(sessionKey) === 'true';
    
    if (!wasInitialized) {
      // Request audio permission on first load
      NotificationSounds.requestAudioPermission();
      sessionStorage.setItem(sessionKey, 'true');
      
      const initializeAlerts = async () => {
        await fetchAlerts();
        const unsubscribe = await setupRealtimeAlerts();
        return unsubscribe;
      };
      
      initializeAlerts().then(unsubscribe => {
        // Store cleanup function for later use
        if (unsubscribe && typeof unsubscribe === 'function') {
          return unsubscribe;
        }
      });
    } else {
      // Just fetch latest data without full initialization
      fetchAlerts();
    }
  }, []); // Remove dependencies to prevent infinite loops

  return {
    alerts,
    loading,
    fetchAlerts,
    createAlert,
    markAlertAsProcessed
  };
};