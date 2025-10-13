import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Ticket } from './useTickets';

interface SimpleRealtimeProps {
  onTicketUpdate: (ticket: Ticket) => void;
  onTicketInsert: (ticket: Ticket) => void;
  onTicketDelete: (ticketId: string) => void;
}

export const useSimpleTicketsRealtime = ({
  onTicketUpdate,
  onTicketInsert,
  onTicketDelete
}: SimpleRealtimeProps) => {
  const { user } = useAuth();
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up simple realtime for tickets');

    // Clean up existing subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    const channel = supabase
      .channel('simple-tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('📡 Simple realtime event:', payload.eventType, payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              onTicketInsert(payload.new as Ticket);
              break;
            case 'UPDATE':
              onTicketUpdate(payload.new as Ticket);
              break;
            case 'DELETE':
              onTicketDelete((payload.old as Ticket).id);
              break;
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_mensagens'
        },
        async (payload) => {
          console.log('📨 Nova mensagem - atualizando ticket:', payload.new.ticket_id);
          
          // Buscar ticket atualizado com sla_pausado_mensagem atualizado
          const { data: ticket } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', payload.new.ticket_id)
            .single();
          
          if (ticket) {
            onTicketUpdate(ticket as any);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Simple realtime status:', status);
      });

    subscriptionRef.current = channel;

    return () => {
      console.log('🧹 Cleaning up simple realtime');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user, onTicketUpdate, onTicketInsert, onTicketDelete]);

  return { isConnected: true };
};