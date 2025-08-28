import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Ticket } from './useTickets';

interface UnifiedRealtimeOptions {
  onTicketInsert: (ticket: Ticket) => void;
  onTicketUpdate: (ticket: Ticket) => void;
  onTicketDelete: (ticketId: string) => void;
}

export const useUnifiedTicketRealtime = ({ onTicketInsert, onTicketUpdate, onTicketDelete }: UnifiedRealtimeOptions) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    console.log('🚀 Setting up UNIFIED ticket realtime for user:', user.id);
    
    const channel = supabase
      .channel('unified-tickets-data', {
        config: {
          presence: { key: user.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('🔄 UNIFIED REALTIME EVENT:', payload.eventType, payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              const newTicket = payload.new as Ticket;
              console.log('➕ PROCESSING NEW TICKET INSERT:', newTicket.codigo_ticket);
              console.log('🎯 Calling onTicketInsert...');
              onTicketInsert(newTicket);
              console.log('✅ onTicketInsert called successfully');
              break;
              
            case 'UPDATE':
              const updatedTicket = payload.new as Ticket;
              console.log('📝 PROCESSING TICKET UPDATE:', updatedTicket.codigo_ticket);
              onTicketUpdate(updatedTicket);
              break;
              
            case 'DELETE':
              const deletedTicket = payload.old as Ticket;
              console.log('🗑️ PROCESSING TICKET DELETE:', deletedTicket.id);
              onTicketDelete(deletedTicket.id);
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 UNIFIED Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ UNIFIED Realtime connected successfully');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ UNIFIED Realtime subscription error');
        }
      });

    return () => {
      console.log('🔌 Cleaning up UNIFIED realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user, onTicketInsert, onTicketUpdate, onTicketDelete]);

  return {
    isConnected: true
  };
};