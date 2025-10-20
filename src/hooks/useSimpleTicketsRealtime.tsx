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

    console.log('🔄 [FASE 2] Setting up realtime com foco em flags SLA');

    // Clean up existing subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    const channel = supabase
      .channel('tickets-realtime-fase2')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        async (payload) => {
          console.log('📡 [FASE 2] Realtime event:', payload.eventType, payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              // Buscar da view para ter SLA calculado
              const { data: newTicket } = await supabase
                .from('tickets_with_realtime_sla')
                .select('*')
                .eq('id', payload.new.id)
                .single();
              
              if (newTicket) {
                console.log('✅ [FASE 2] INSERT com SLA calculado:', newTicket.sla_minutos_restantes_calculado);
                onTicketInsert(newTicket as any);
              }
              break;
              
            case 'UPDATE':
              // ✅ CRÍTICO: Buscar da view para ter SLA atualizado
              const { data: updatedTicket } = await supabase
                .from('tickets_with_realtime_sla')
                .select('*')
                .eq('id', payload.new.id)
                .single();
              
              if (updatedTicket) {
                // Log mudanças em flags de pausa
                const old = payload.old as any;
                const nw = updatedTicket as any;
                
                if (old.sla_pausado !== nw.sla_pausado) {
                  console.log(`⏸️ [FASE 2] SLA Pausado mudou: ${old.sla_pausado} → ${nw.sla_pausado}`);
                }
                if (old.sla_pausado_mensagem !== nw.sla_pausado_mensagem) {
                  console.log(`💬 [FASE 2] SLA Pausado Mensagem mudou: ${old.sla_pausado_mensagem} → ${nw.sla_pausado_mensagem}`);
                }
                if (old.sla_pausado_horario !== nw.sla_pausado_horario) {
                  console.log(`🕐 [FASE 2] SLA Pausado Horário mudou: ${old.sla_pausado_horario} → ${nw.sla_pausado_horario}`);
                }
                
                console.log(`✅ [FASE 2] UPDATE com SLA recalculado: ${nw.sla_minutos_restantes_calculado} min`);
                onTicketUpdate(updatedTicket as any);
              }
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
          console.log('📨 [FASE 2] Nova mensagem - ticket será pausado:', payload.new.ticket_id);
          
          // ✅ Aguardar 500ms para trigger de pausa executar
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Buscar ticket atualizado da view
          const { data: ticket } = await supabase
            .from('tickets_with_realtime_sla')
            .select('*')
            .eq('id', payload.new.ticket_id)
            .single();
          
          if (ticket) {
            console.log(`✅ [FASE 2] Ticket atualizado após mensagem. Pausado: ${ticket.sla_pausado_mensagem}`);
            onTicketUpdate(ticket as any);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [FASE 2] Realtime status:', status);
      });

    subscriptionRef.current = channel;

    return () => {
      console.log('🧹 [FASE 2] Cleaning up realtime');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user, onTicketUpdate, onTicketInsert, onTicketDelete]);

  return { isConnected: true };
};