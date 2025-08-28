import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Ticket } from './useTickets';

interface SimpleRealtimeOptions {
  onTicketInsert: (ticket: Ticket) => void;
  onTicketUpdate: (ticket: Ticket) => void;
  onTicketDelete: (ticketId: string) => void;
  enabled: boolean;
}

export const useSimpleTicketRealtime = ({
  onTicketInsert,
  onTicketUpdate,
  onTicketDelete,
  enabled
}: SimpleRealtimeOptions) => {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || !user) {
      // Cleanup existing channel
      if (channelRef.current) {
        console.log('🔌 SIMPLE: Cleaning up realtime channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Create a simple, direct realtime subscription
    console.log('🔄 SIMPLE: Setting up realtime subscription');
    
    const channel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        async (payload) => {
          console.log('🔄 SIMPLE: Received realtime event:', payload.eventType);
          
          try {
            if (payload.eventType === 'INSERT' && payload.new && payload.new.id) {
              // Fetch complete ticket data with joins
              const { data: fullTicket } = await supabase
                .from('tickets')
                .select(`
                  *,
                  equipes!equipe_responsavel_id(id, nome),
                  unidades(id, grupo, cidade, uf),
                  colaboradores(nome_completo)
                `)
                .eq('id', payload.new.id)
                .single();

              if (fullTicket) {
                console.log('✅ SIMPLE: Processing INSERT for ticket:', fullTicket.codigo_ticket);
                onTicketInsert(fullTicket as any);
              }
            }
            
            if (payload.eventType === 'UPDATE' && payload.new && payload.new.id) {
              // Fetch complete ticket data with joins
              const { data: fullTicket } = await supabase
                .from('tickets')
                .select(`
                  *,
                  equipes!equipe_responsavel_id(id, nome),
                  unidades(id, grupo, cidade, uf),
                  colaboradores(nome_completo)
                `)
                .eq('id', payload.new.id)
                .single();

              if (fullTicket) {
                console.log('✅ SIMPLE: Processing UPDATE for ticket:', fullTicket.codigo_ticket, 'status:', fullTicket.status);
                onTicketUpdate(fullTicket as any);
              }
            }
            
            if (payload.eventType === 'DELETE' && payload.old) {
              console.log('✅ SIMPLE: Processing DELETE for ticket:', payload.old.id);
              onTicketDelete(payload.old.id);
            }
          } catch (error) {
            console.error('❌ SIMPLE: Error processing realtime event:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 SIMPLE: Realtime status:', status);
      });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      if (channelRef.current) {
        console.log('🔌 SIMPLE: Cleaning up realtime channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, user, onTicketInsert, onTicketUpdate, onTicketDelete]);

  return {
    isConnected: !!channelRef.current
  };
};