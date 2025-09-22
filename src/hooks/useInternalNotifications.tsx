import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserEquipes } from './useUserEquipes';
import { useToast } from './use-toast';

export interface InternalNotification {
  id: string;
  title: string;
  message: string;
  type: 'ticket' | 'sla' | 'alert' | 'info' | 'crisis' | 'franqueado_respondeu';
  equipe_id?: string | null;
  created_by?: string | null;
  created_at: string;
  payload?: Record<string, any> | null;
  ticket_id?: string | null;
  recipient_status?: {
    is_read: boolean;
    read_at: string | null;
  };
  equipe?: {
    nome: string;
  };
}

export const useInternalNotifications = () => {
  const { user } = useAuth();
  const { userEquipes } = useUserEquipes();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications with recipient status
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['internal-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('🔔 No user ID, returning empty notifications');
        return [];
      }

      console.log('🔔 Fetching notifications for user:', user.id);

      // Query com ordem correta para pegar as mais recentes
      const { data, error } = await supabase
        .from('internal_notifications')
        .select(`
          id,
          title,
          message,
          type,
          equipe_id,
          created_by,
          created_at,
          payload,
          equipes(nome),
          internal_notification_recipients!inner(
            is_read,
            read_at
          )
        `)
        .eq('internal_notification_recipients.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('🔔 Error fetching notifications:', error);
        throw error;
      }

      console.log('🔔 Fetched notifications raw data:', data?.length, 'items');

      const mappedNotifications = data.map(item => ({
        id: item.id,
        title: item.title,
        message: item.message,
        type: item.type,
        equipe_id: item.equipe_id,
        created_by: item.created_by,
        created_at: item.created_at,
        payload: item.payload,
        recipient_status: {
          is_read: item.internal_notification_recipients[0]?.is_read || false,
          read_at: item.internal_notification_recipients[0]?.read_at || null,
        },
        equipe: item.equipes
      })) as InternalNotification[];

      console.log('🔔 Mapped notifications:', mappedNotifications.length, 'items');
      console.log('🔔 Unread count:', mappedNotifications.filter(n => !n.recipient_status?.is_read).length);
      
      // Ordenar para colocar não lidas no topo
      const sortedNotifications = mappedNotifications.sort((a, b) => {
        // Primeiro critério: não lidas primeiro
        if (!a.recipient_status?.is_read && b.recipient_status?.is_read) return -1;
        if (a.recipient_status?.is_read && !b.recipient_status?.is_read) return 1;
        
        // Segundo critério: mais recentes primeiro (dentro de cada grupo)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      return sortedNotifications;
    },
    enabled: !!user?.id,
  });

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('internal_notification_recipients')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('notification_id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Optimistically update the cache
      queryClient.setQueryData(['internal-notifications', user.id], (old: InternalNotification[] = []) =>
        old.map(notification =>
          notification.id === notificationId
            ? {
                ...notification,
                recipient_status: {
                  is_read: true,
                  read_at: new Date().toISOString(),
                },
              }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar notificação como lida",
        variant: "destructive",
      });
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const unreadNotifications = notifications.filter(
        n => !n.recipient_status?.is_read
      );

      if (unreadNotifications.length === 0) return;

      const { error } = await supabase
        .from('internal_notification_recipients')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Refresh the query
      queryClient.invalidateQueries({ queryKey: ['internal-notifications', user.id] });

      toast({
        title: "Sucesso",
        description: `${unreadNotifications.length} notificações marcadas como lidas`,
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar todas as notificações como lidas",
        variant: "destructive",
      });
    }
  };

  // Set up real-time subscription  
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔔 Setting up internal notifications realtime for user:', user.id);

    const channel = supabase
      .channel(`internal-notification-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_notification_recipients',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('🔔 🆕 NOVA NOTIFICAÇÃO RECEBIDA!');
          console.log('🔔 Payload completo:', payload);
          console.log('🔔 Dados da nova notificação:', payload.new);
          
          // Fetch the full notification details immediately
          const { data: notificationDetails, error } = await supabase
            .from('internal_notifications')
            .select('*')
            .eq('id', payload.new.notification_id)
            .single();

          if (error) {
            console.error('🔔 ❌ Erro ao buscar detalhes da notificação:', error);
            return;
          }

          console.log('🔔 ✅ Detalhes completos da notificação:', notificationDetails);
          
          // Update cache directly with the new notification
          queryClient.setQueryData(['internal-notifications', user.id], (oldData: InternalNotification[] | undefined) => {
            if (!notificationDetails) return oldData || [];
            
            const newNotification: InternalNotification = {
              id: notificationDetails.id,
              title: notificationDetails.title,
              message: notificationDetails.message,
              type: notificationDetails.type as 'ticket' | 'sla' | 'alert' | 'info' | 'crisis' | 'franqueado_respondeu',
              ticket_id: (notificationDetails.payload as any)?.ticket_id || null,
              created_at: payload.new.created_at,
              payload: notificationDetails.payload as Record<string, any> || null,
              recipient_status: {
                is_read: false,
                read_at: null
              }
            };
            
            console.log('🔔 ✅ Adicionando notificação ao cache:', newNotification);
            const updatedData = [newNotification, ...(oldData || [])];
            console.log('🔔 📊 Cache atualizado, total de notificações:', updatedData.length);
            return updatedData;
          });

          // Show toast notification
          if (notificationDetails?.type === 'franqueado_respondeu') {
            console.log('🔔 💬 Exibindo toast para resposta de franqueado');
            toast({
              title: "💬 Franqueado Respondeu!",
              description: notificationDetails.message || "Nova resposta recebida",
              duration: 5000,
            });
            
            // Play notification sound
            try {
              const audio = new Audio('/notification-sound.mp3');
              audio.volume = 0.7;
              console.log('🔔 🔊 Reproduzindo som de notificação');
              audio.play().catch(e => console.log('🔔 ❌ Erro ao reproduzir som:', e));
            } catch (error) {
              console.log('🔔 ❌ Erro ao criar áudio:', error);
            }
          } else {
            // Generic notification toast
            console.log('🔔 📢 Exibindo toast genérico');
            toast({
              title: "🔔 Nova Notificação",
              description: notificationDetails.title || "Você tem uma nova notificação",
              duration: 4000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_notification_recipients',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('🔔 📝 Notificação atualizada (lida/não lida):', payload);
          // Force immediate refetch when notifications are marked as read
          queryClient.refetchQueries({ 
            queryKey: ['internal-notifications', user.id] 
          });
        }
      )
      .subscribe((status) => {
        console.log('🔔 📡 STATUS DA CONEXÃO REALTIME:', status);
        if (status === 'SUBSCRIBED') {
          console.log('🔔 ✅ REALTIME CONECTADO COM SUCESSO!');
        } else if (status === 'CLOSED') {
          console.log('🔔 ❌ CONEXÃO REALTIME PERDIDA!');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('🔔 ⚠️ ERRO NO CANAL REALTIME!');
        }
      });

    return () => {
      console.log('🔔 🧹 Limpando conexão realtime para user:', user.id);
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, toast]);

  // Get unread count
  const unreadCount = notifications.filter(
    n => !n.recipient_status?.is_read
  ).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: () => queryClient.invalidateQueries({ 
      queryKey: ['internal-notifications', user?.id] 
    }),
  };
};