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
  const [realtimeAttempted, setRealtimeAttempted] = useState(false);
  const retryAttemptRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setupRealtime = useCallback(() => {
    if (!user) return;

    // Mark that we attempted realtime
    setRealtimeAttempted(true);

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
    
    // In Lovable environment, realtime often fails, so set a shorter timeout
    // If realtime doesn't work quickly, we'll simulate success with polling
    const fallbackTimer = setTimeout(() => {
      if (connectionStatus !== 'SUBSCRIBED') {
        console.log('🔄 ENHANCED: Realtime taking too long, switching to optimized polling mode');
        setConnectionStatus('DEGRADED');
      }
    }, 3000); // Only wait 3 seconds
    
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
          
          // SEMPRE processar eventos UPDATE de mudança de status para garantir Kanban sync
          if (payload.eventType === 'UPDATE' && oldTicket && ticket && oldTicket.status !== ticket.status) {
            shouldProcess = true;
            console.log('🎯 FORÇANDO processamento de UPDATE de status:', oldTicket.status, '->', ticket.status);
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
        
        // Clear fallback timer if we get a proper status
        clearTimeout(fallbackTimer);
        
        setConnectionStatus(status as any);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ ENHANCED realtime subscription active');
          retryAttemptRef.current = 0; // Reset retry count on success
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ ENHANCED realtime subscription error/timeout:', status);
          
          // In Lovable, realtime often doesn't work, so just go to degraded mode immediately
          console.log('🚫 ENHANCED: Realtime not supported in this environment, using polling');
          setConnectionStatus('DEGRADED');
        }
      });

    subscriptionRef.current = channel;
    
    return () => {
      clearTimeout(fallbackTimer);
    };
  }, [user, onTicketUpdate, onTicketInsert, onTicketDelete, filters]); // Removido connectionStatus para evitar loop infinito

  useEffect(() => {
    const cleanup = setupRealtime();

    return () => {
      console.log('🔌 Disconnecting ENHANCED realtime');
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      if (cleanup) cleanup();
    };
  }, [setupRealtime]);

  return {
    isConnected: connectionStatus === 'SUBSCRIBED',
    isDegraded: connectionStatus === 'DEGRADED',
    status: connectionStatus,
    retryCount: retryAttemptRef.current,
    realtimeAttempted
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