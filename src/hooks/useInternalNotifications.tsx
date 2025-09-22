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

  // SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL SEMPRE ATIVO
  useEffect(() => {
    console.log('🔔 ⚡ INICIANDO SISTEMA REALTIME - SEMPRE ATIVO!');
    console.log('🔔 ⚡ User ID:', user?.id);
    
    if (!user?.id) {
      console.log('🔔 ❌ Sem usuário logado - sistema desligado');
      return;
    }

    console.log('🔔 🚀 CONFIGURANDO CANAL REALTIME PARA:', user.id);

    const channel = supabase
      .channel(`always-on-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_notification_recipients',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('🔔 🎯 NOVA NOTIFICAÇÃO INTERCEPTADA!', payload);
          
          try {
            // Buscar detalhes completos da notificação
            const { data: notificationDetails, error } = await supabase
              .from('internal_notifications')
              .select('*')
              .eq('id', payload.new.notification_id)
              .single();

            if (error) {
              console.error('🔔 ❌ Erro ao buscar notificação:', error);
              return;
            }

            console.log('🔔 ✅ Detalhes da notificação:', notificationDetails);
            
            // FORÇAR REFETCH da query principal
            console.log('🔔 🔄 FORÇANDO REFETCH...');
            queryClient.invalidateQueries({ 
              queryKey: ['internal-notifications', user.id] 
            });
            
            // Também atualizar cache direto
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
              
              console.log('🔔 ➕ Adicionando ao cache:', newNotification);
              const updatedData = [newNotification, ...(oldData || [])];
              console.log('🔔 📊 Novo total no cache:', updatedData.length);
              return updatedData;
            });

            // Toast
            if (notificationDetails?.type === 'franqueado_respondeu') {
              console.log('🔔 💬 Toast franqueado respondeu');
              toast({
                title: "💬 Franqueado Respondeu!",
                description: notificationDetails.message || "Nova resposta recebida",
                duration: 6000,
              });
              
              // Som - IMPLEMENTAÇÃO ROBUSTA
              console.log('🔔 🔊 TENTANDO REPRODUZIR SOM...');
              
              // Importar o manager de áudio
              import('@/lib/audio-manager').then(async ({ playNotificationSound }) => {
                const success = await playNotificationSound(0.8);
                if (!success) {
                  console.log('🔔 ⚠️ Som não reproduzido - mostrando aviso ao usuário');
                  toast({
                    title: "🔊 Som Bloqueado",
                    description: "Clique em qualquer lugar da página para habilitar sons de notificação",
                    duration: 5000,
                  });
                }
              }).catch(error => {
                console.log('🔔 ❌ Erro ao carregar audio manager:', error);
              });
            } else {
              // Toast genérico para outros tipos
              console.log('🔔 📢 Toast genérico');
              toast({
                title: "🔔 Nova Notificação",
                description: notificationDetails.title || "Nova notificação",
                duration: 4000,
              });
              
              // Som também para outros tipos de notificação
              console.log('🔔 🔊 Som para notificação genérica...');
              
              // Usar o manager de áudio
              import('@/lib/audio-manager').then(async ({ playNotificationSound }) => {
                await playNotificationSound(0.5); // Volume menor para notificações gerais
              }).catch(error => {
                console.log('🔔 ❌ Erro ao carregar audio manager para notificação genérica:', error);
              });
            }
          } catch (error) {
            console.error('🔔 ❌ Erro processar notificação:', error);
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
          console.log('🔔 📝 Notificação marcada como lida:', payload);
          // Refetch para atualizar contador
          queryClient.invalidateQueries({ 
            queryKey: ['internal-notifications', user.id] 
          });
        }
      )
      .subscribe((status) => {
        console.log('🔔 📡 STATUS CONEXÃO REALTIME:', status);
        if (status === 'SUBSCRIBED') {
          console.log('🔔 ✅ SISTEMA REALTIME ATIVO E CONECTADO!');
        } else if (status === 'CLOSED') {
          console.log('🔔 ❌ CONEXÃO PERDIDA!');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('🔔 ⚠️ ERRO NO CANAL!');
        }
      });

    return () => {
      console.log('🔔 🧹 Limpando sistema realtime para:', user.id);
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, toast]);

  // Set up a polling backup as well
  useEffect(() => {
    if (!user?.id) return;
    
    console.log('🔔 ⏰ Configurando polling backup a cada 30s');
    
    const interval = setInterval(() => {
      console.log('🔔 🔄 Polling backup - refetch notifications');
      queryClient.invalidateQueries({ 
        queryKey: ['internal-notifications', user.id] 
      });
    }, 30000);

    return () => {
      console.log('🔔 🧹 Limpando polling backup');
      clearInterval(interval);
    };
  }, [user?.id, queryClient]);

  // Get unread count
  const unreadCount = notifications.filter(
    n => !n.recipient_status?.is_read
  ).length;
  
  console.log('🔔 📊 HOOK: Total notificações:', notifications.length);
  console.log('🔔 📊 HOOK: Não lidas:', unreadCount);
  console.log('🔔 📊 HOOK: Detalhes não lidas:', notifications.filter(n => !n.recipient_status?.is_read).map(n => ({ id: n.id, type: n.type, is_read: n.recipient_status?.is_read })));

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