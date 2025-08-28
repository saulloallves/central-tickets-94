
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { Ticket } from './useTickets';

interface UseRealtimeTicketsOptions {
  onTicketUpdate: (ticket: Ticket) => void;
  onTicketInsert: (ticket: Ticket) => void;
  onTicketDelete: (ticketId: string) => void;
  enabled?: boolean;
}

export const useRealtimeTickets = (options: UseRealtimeTicketsOptions) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { onTicketUpdate, onTicketInsert, onTicketDelete, enabled = true } = options;
  const subscriptionRef = useRef<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'SUBSCRIBED' | 'ERROR'>('CONNECTING');

  const setupRealtime = useCallback(() => {
    if (!user || !enabled) return;

    console.log('🔄 Setting up REALTIME subscription for tickets');

    // Limpar qualquer inscrição existente
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        async (payload) => {
          console.log('🎯 REALTIME EVENT:', payload.eventType, payload);
          
          try {
            switch (payload.eventType) {
              case 'INSERT': {
                const ticket = payload.new as Ticket;
                console.log('➕ Novo ticket inserido:', ticket.codigo_ticket);
                
                onTicketInsert(ticket);
                
                toast({
                  title: "🎫 Novo Ticket",
                  description: `Ticket ${ticket.codigo_ticket} criado`,
                  duration: 3000,
                });
                break;
              }
              
              case 'UPDATE': {
                const ticket = payload.new as Ticket;
                const oldTicket = payload.old as Ticket;
                
                console.log('📝 Ticket atualizado:', ticket.codigo_ticket, {
                  oldStatus: oldTicket?.status,
                  newStatus: ticket.status,
                });
                
                onTicketUpdate(ticket);
                
                // Toast apenas para mudanças de status importantes
                if (oldTicket?.status !== ticket.status) {
                  toast({
                    title: "🔄 Status Atualizado",
                    description: `Ticket ${ticket.codigo_ticket}: ${ticket.status}`,
                    duration: 2000,
                  });
                }
                break;
              }
              
              case 'DELETE': {
                const deletedTicket = payload.old as Ticket;
                console.log('🗑️ Ticket deletado:', deletedTicket.id);
                onTicketDelete(deletedTicket.id);
                break;
              }
            }
          } catch (error) {
            console.error('❌ Erro ao processar evento Realtime:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
        setConnectionStatus(status as any);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime conectado com sucesso');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Erro na conexão Realtime:', status);
        }
      });

    subscriptionRef.current = channel;
  }, [user, enabled, onTicketUpdate, onTicketInsert, onTicketDelete, toast]);

  useEffect(() => {
    setupRealtime();

    return () => {
      console.log('🔌 Desconectando Realtime');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [setupRealtime]);

  return {
    isConnected: connectionStatus === 'SUBSCRIBED',
    status: connectionStatus,
  };
};
