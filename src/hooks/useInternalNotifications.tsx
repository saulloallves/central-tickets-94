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
    
    // Force immediate refetch to ensure we have latest data
    queryClient.invalidateQueries({ 
      queryKey: ['internal-notifications', user.id] 
    });

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
        async (payload) => {
          console.log('🔔 New internal notification received:', payload);
          console.log('🔔 Payload new data:', payload.new);
          
          // Fetch the full notification details
          const { data: notificationDetails } = await supabase
            .from('internal_notifications')
            .select('*')
            .eq('id', payload.new.notification_id)
            .single();

          console.log('🔔 Full notification details:', notificationDetails);
          
          // Force immediate refetch - use refetchQueries instead of invalidateQueries
          await queryClient.refetchQueries({ 
            queryKey: ['internal-notifications', user.id] 
          });

          // Show specific toast for franqueado response
          if (notificationDetails?.type === 'franqueado_respondeu') {
            toast({
              title: "💬 Franqueado Respondeu!",
              description: notificationDetails.message || "Nova resposta recebida",
            });
            
            // Play notification sound
            try {
              const audio = new Audio('/notification-sound.mp3');
              audio.volume = 0.5;
              audio.play().catch(e => console.log('Erro ao reproduzir som:', e));
            } catch (error) {
              console.log('Erro ao criar áudio:', error);
            }
          } else {
            // Generic notification
            toast({
              title: "Nova notificação",
              description: "Você tem uma nova notificação",
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
          console.log('🔔 Internal notification updated:', payload);
          console.log('🔔 Update payload:', payload.new);
          // Force immediate refetch
          await queryClient.refetchQueries({ 
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