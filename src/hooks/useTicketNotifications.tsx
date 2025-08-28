import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { NotificationSounds } from '@/lib/notification-sounds';

export const useTicketNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Initialize notification sounds
  useEffect(() => {
    NotificationSounds.requestAudioPermission();
  }, []);

  // Listen for new tickets in realtime
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('ticket-notifications-main')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          const newTicket = payload.new as any;
          
          // Don't show notification if ticket was created by current user
          if (newTicket.criado_por === user.id) {
            return;
          }

          // Play notification sound based on priority
          const soundType = newTicket.prioridade === 'crise' ? 'critical' : 
                          newTicket.prioridade === 'imediato' ? 'warning' : 'info';
          NotificationSounds.playNotificationSound(soundType);

          // Show toast notification
          toast({
            title: "🎫 Novo Ticket Recebido",
            description: `${newTicket.titulo || newTicket.descricao_problema || 'Sem título'} - ${newTicket.codigo_ticket}`,
            duration: 5000,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          const updatedTicket = payload.new as any;
          const oldTicket = payload.old as any;
          
          // Don't notify for own updates
          if (updatedTicket.criado_por === user.id) {
            return;
          }

          // Notify when ticket becomes crisis or escalates priority
          if (updatedTicket.prioridade === 'crise' && oldTicket?.prioridade !== 'crise') {
            NotificationSounds.playCriticalAlert();
            toast({
              title: "🚨 CRISE DETECTADA",
              description: `Ticket ${updatedTicket.codigo_ticket} escalado para CRISE`,
              duration: 8000,
              variant: "destructive"
            });
          } else if (updatedTicket.prioridade === 'imediato' && 
                    oldTicket?.prioridade !== 'imediato' && 
                    oldTicket?.prioridade !== 'crise') {
            NotificationSounds.playNotificationSound('warning');
            toast({
              title: "⚠️ Prioridade Escalada",
              description: `Ticket ${updatedTicket.codigo_ticket} agora é IMEDIATO`,
              duration: 4000,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Notification channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  // Function to test notification sound manually
  const testNotificationSound = async () => {
    await NotificationSounds.playNotificationSound('info');
  };

  const testCriticalSound = async () => {
    NotificationSounds.playCriticalAlert();
  };

  return {
    testNotificationSound,
    testCriticalSound
  };
};