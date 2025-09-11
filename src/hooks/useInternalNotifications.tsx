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
  type: 'ticket' | 'sla' | 'alert' | 'info' | 'crisis';
  equipe_id: string | null;
  created_by: string | null;
  created_at: string;
  payload: Record<string, any>;
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

      const { data, error } = await supabase
        .from('internal_notification_recipients')
        .select(`
          notification_id,
          is_read,
          read_at,
          internal_notifications!inner(
            id,
            title,
            message,
            type,
            equipe_id,
            created_by,
            created_at,
            payload,
            equipes(nome)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { 
          ascending: false,
          referencedTable: 'internal_notifications'
        })
        .limit(50);

      if (error) {
        console.error('🔔 Error fetching notifications:', error);
        throw error;
      }

      console.log('🔔 Fetched notifications raw data:', data?.length, 'items');

      const mappedNotifications = data.map(item => ({
        id: item.internal_notifications.id,
        title: item.internal_notifications.title,
        message: item.internal_notifications.message,
        type: item.internal_notifications.type,
        equipe_id: item.internal_notifications.equipe_id,
        created_by: item.internal_notifications.created_by,
        created_at: item.internal_notifications.created_at,
        payload: item.internal_notifications.payload,
        recipient_status: {
          is_read: item.is_read,
          read_at: item.read_at,
        },
        equipe: item.internal_notifications.equipes
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
      .channel('internal-notification-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_notification_recipients',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔔 New internal notification received:', payload);
          console.log('🔔 Payload new data:', payload.new);
          // Invalidate queries to refetch
          queryClient.invalidateQueries({ 
            queryKey: ['internal-notifications', user.id] 
          });

          // Show toast notification
          toast({
            title: "Nova notificação",
            description: "Você tem uma nova notificação",
          });
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
        (payload) => {
          console.log('🔔 Internal notification updated:', payload);
          console.log('🔔 Update payload:', payload.new);
          // Invalidate queries to refetch
          queryClient.invalidateQueries({ 
            queryKey: ['internal-notifications', user.id] 
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🔔 Cleaning up internal notifications realtime for user:', user.id);
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