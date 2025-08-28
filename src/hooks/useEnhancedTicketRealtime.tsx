import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Ticket } from './useTickets';
import { NotificationSounds } from '@/lib/notification-sounds';

interface EnhancedRealtimeOptions {
  onTicketUpdate: (ticket: Ticket) => void;
  onTicketInsert: (ticket: Ticket) => void;
  onTicketDelete: (ticketId: string) => void;
  filters?: {
    unidade_id?: string;
    equipe_id?: string;
    status?: string[];
  };
}

export const useEnhancedTicketRealtime = (options: EnhancedRealtimeOptions) => {
  const { user } = useAuth();
  const { onTicketUpdate, onTicketInsert, onTicketDelete, filters } = options;
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up enhanced realtime subscription for user:', user.id);
    console.log('🔄 Filters:', filters);
    
    // Initialize audio for notifications
    NotificationSounds.requestAudioPermission();

    // Use a unique channel name with timestamp to avoid conflicts
    const channelName = `enhanced-tickets-${user.id}-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          console.log('🔄 REALTIME TICKET EVENT:', payload.eventType, payload);
          
          const ticket = payload.new as Ticket;
          const oldTicket = payload.old as Ticket;

          // Apply client-side filtering to reduce noise
          let shouldProcess = true;
          if (filters) {
            shouldProcess = filterTicketEvent(ticket || oldTicket, filters);
            if (!shouldProcess) {
              console.log('🔇 Event filtered out:', payload.eventType, 'ticket:', ticket?.codigo_ticket || oldTicket?.codigo_ticket);
            }
          }
          
          // SEMPRE processar eventos INSERT para garantir que novos tickets apareçam
          if (payload.eventType === 'INSERT') {
            shouldProcess = true;
            console.log('🎯 FORÇANDO processamento de INSERT para garantir que ticket apareça');
          }
          
          if (!shouldProcess) {
            return;
          }

          // Performance timing
          const eventStart = performance.now();

           switch (payload.eventType) {
             case 'INSERT':
               console.log('➕ PROCESSANDO NOVO TICKET:', ticket.codigo_ticket, 'ID:', ticket.id);
               console.log('🎯 Chamando onTicketInsert callback...');
               
               // Não tocar som aqui - delegado para useTicketNotifications
               // para evitar duplicação
               
               onTicketInsert(ticket);
               console.log('✅ onTicketInsert executado');
               break;
              
            case 'UPDATE':
              console.log('📝 Ticket updated:', ticket.codigo_ticket, {
                oldStatus: oldTicket?.status,
                newStatus: ticket.status,
                oldPriority: oldTicket?.prioridade,
                newPriority: ticket.prioridade
              });
              
              // Play sound if priority escalated or became crisis
              if (ticket.prioridade === 'crise' && oldTicket?.prioridade !== 'crise') {
                NotificationSounds.playCriticalAlert();
              } else if (ticket.prioridade === 'imediato' && oldTicket?.prioridade !== 'imediato' && oldTicket?.prioridade !== 'crise') {
                NotificationSounds.playNotificationSound('warning');
              }
              
              onTicketUpdate(ticket);
              break;
              
            case 'DELETE':
              console.log('🗑️ Ticket deleted:', oldTicket.id);
              onTicketDelete(oldTicket.id);
              break;
          }

          // Log performance
          const eventEnd = performance.now();
          console.log(`⚡ Event processing time: ${(eventEnd - eventStart).toFixed(2)}ms`);
        }
      )
      .subscribe((status) => {
        console.log('📡 Enhanced realtime status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Enhanced realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Enhanced realtime subscription error');
        }
      });

    subscriptionRef.current = channel;

    return () => {
      console.log('🔌 Disconnecting enhanced realtime');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [user, onTicketUpdate, onTicketInsert, onTicketDelete, filters]);

  return {
    isConnected: !!subscriptionRef.current
  };
};

// Client-side filtering function to reduce realtime noise
const filterTicketEvent = (ticket: Ticket, filters: EnhancedRealtimeOptions['filters']) => {
  if (!ticket || !filters) return true;

  // Filter by unidade_id
  if (filters.unidade_id && ticket.unidade_id !== filters.unidade_id) {
    return false;
  }

  // Filter by equipe_id
  if (filters.equipe_id && ticket.equipe_responsavel_id !== filters.equipe_id) {
    return false;
  }

  // Filter by status array
  if (filters.status && filters.status.length > 0 && !filters.status.includes(ticket.status)) {
    return false;
  }

  return true;
};