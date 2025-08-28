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

    console.log('🔔 Setting up ticket notifications for user:', user.id);

    // Simpler channel name to avoid conflicts
    const channelName = `tickets-notifications-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('🎫 New ticket INSERT event:', payload);
          const newTicket = payload.new as any;
          
          // Play sound for all new tickets except those created by current user
          if (newTicket.criado_por !== user.id) {
            console.log('🔊 Playing notification sound for new ticket:', newTicket.codigo_ticket);
            
            // Determine sound type based on priority
            let soundType: 'info' | 'warning' | 'critical' = 'info';
            if (newTicket.prioridade === 'crise') {
              soundType = 'critical';
            } else if (newTicket.prioridade === 'imediato') {
              soundType = 'warning';
            }
            
            // Play the sound
            NotificationSounds.playNotificationSound(soundType);

            // Show toast notification
            toast({
              title: "🎫 Novo Ticket Recebido",
              description: `${newTicket.titulo || newTicket.descricao_problema || 'Sem título'} - ${newTicket.codigo_ticket}`,
              duration: 5000,
            });
          } else {
            console.log('👤 Skipping notification - ticket created by current user');
          }
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
          console.log('📝 Ticket UPDATE event:', payload);
          const updatedTicket = payload.new as any;
          const oldTicket = payload.old as any;
          
          // Don't notify for own updates
          if (updatedTicket.criado_por === user.id) {
            console.log('👤 Skipping update notification - updated by current user');
            return;
          }

          // Check for priority escalation
          if (updatedTicket.prioridade === 'crise' && oldTicket?.prioridade !== 'crise') {
            console.log('🚨 Playing CRISIS alert for ticket:', updatedTicket.codigo_ticket);
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
            console.log('⚠️ Playing WARNING alert for priority escalation:', updatedTicket.codigo_ticket);
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
        if (status === 'SUBSCRIBED') {
          console.log('✅ Notification system connected successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Notification subscription error');
        }
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