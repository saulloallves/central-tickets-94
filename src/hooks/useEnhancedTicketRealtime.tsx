import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'SUBSCRIBED' | 'DEGRADED' | 'ERROR'>('CONNECTING');
  const retryAttemptRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setupRealtime = useCallback(() => {
    if (!user) return;

    console.log('🔄 Setting up ENHANCED realtime subscription for user:', user.id);
    console.log('🔄 Filters:', filters);
    
    // Initialize audio for notifications
    NotificationSounds.requestAudioPermission();

    // Use a simpler, more reliable channel setup
    const channelName = `tickets-${user.id}`;
    
    // Clean up any existing subscription first
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    
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
          console.log('🔄 ROBUST REALTIME EVENT:', payload.eventType, payload);
          
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
            console.log('🎯 FORÇANDO processamento de INSERT');
          }
          
          if (!shouldProcess) {
            return;
          }

          // Performance timing
          const eventStart = performance.now();

           switch (payload.eventType) {
             case 'INSERT':
               console.log('➕ ROBUST: PROCESSANDO NOVO TICKET:', ticket.codigo_ticket, 'ID:', ticket.id);
               console.log('🎯 ROBUST: Chamando onTicketInsert callback...');
               
               onTicketInsert(ticket);
               console.log('✅ ROBUST: onTicketInsert executado');
               break;
              
            case 'UPDATE':
              console.log('📝 ROBUST: Ticket updated:', ticket.codigo_ticket, {
                oldStatus: oldTicket?.status,
                newStatus: ticket.status,
                oldPriority: oldTicket?.prioridade,
                newPriority: ticket.prioridade
              });
              
              onTicketUpdate(ticket);
              break;
              
            case 'DELETE':
              console.log('🗑️ ROBUST: Ticket deleted:', oldTicket.id);
              onTicketDelete(oldTicket.id);
              break;
          }

          // Log performance
          const eventEnd = performance.now();
          console.log(`⚡ ROBUST: Event processing time: ${(eventEnd - eventStart).toFixed(2)}ms`);
        }
      )
      .subscribe((status) => {
        console.log('📡 ENHANCED realtime status:', status);
        setConnectionStatus(status as any);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ ENHANCED realtime subscription active');
          retryAttemptRef.current = 0; // Reset retry count on success
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ ENHANCED realtime subscription error/timeout:', status);
          setConnectionStatus('ERROR');
          
          // More aggressive retry strategy - try once more then go to polling
          if (retryAttemptRef.current < 1) {
            console.log(`🔄 ENHANCED: Quick retry attempt ${retryAttemptRef.current + 1}/1`);
            
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            
            retryTimeoutRef.current = setTimeout(() => {
              retryAttemptRef.current++;
              setupRealtime(); // Retry connection
            }, 1000); // Quick 1s retry
          } else {
            console.log('🚫 ENHANCED: Switching to polling mode after 1 retry');
            setConnectionStatus('DEGRADED');
            // Try again after 2 minutes
            retryTimeoutRef.current = setTimeout(() => {
              console.log('🔄 ENHANCED: Attempting realtime reconnection after cooldown');
              retryAttemptRef.current = 0;
              setupRealtime();
            }, 120000); // 2 minutes
          }
        }
      });

    subscriptionRef.current = channel;
  }, [user, onTicketUpdate, onTicketInsert, onTicketDelete, filters]);

  useEffect(() => {
    setupRealtime();

    return () => {
      console.log('🔌 Disconnecting ENHANCED realtime');
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [setupRealtime]);

  return {
    isConnected: connectionStatus === 'SUBSCRIBED',
    isDegraded: connectionStatus === 'ERROR' || connectionStatus === 'DEGRADED',
    status: connectionStatus,
    retryCount: retryAttemptRef.current
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