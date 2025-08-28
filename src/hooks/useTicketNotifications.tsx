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

    console.log('🔔 Setting up ticket notifications...');

    const channel = supabase
      .channel('ticket-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('🎫 New ticket event:', payload);
          const newTicket = payload.new as any;
          
          // Don't show notification if ticket was created by current user
          if (newTicket.criado_por === user.id) {
            console.log('👤 Skipping notification - created by current user');
            return;
          }

          console.log('🔊 Playing notification sound for new ticket');
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
          console.log('📝 Ticket update event:', payload);
          const updatedTicket = payload.new as any;
          const oldTicket = payload.old as any;
          
          // Don't notify for own updates
          if (updatedTicket.criado_por === user.id) {
            console.log('👤 Skipping update notification - updated by current user');
            return;
          }

          // Notify when ticket becomes crisis or escalates priority
          if (updatedTicket.prioridade === 'crise' && oldTicket?.prioridade !== 'crise') {
            console.log('🚨 Playing CRISIS alert');
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
            console.log('⚠️ Playing WARNING alert');
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
        console.log('🔔 Notification subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up notification subscription');
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