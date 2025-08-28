import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { useUserEquipes } from './useUserEquipes';
import { useToast } from './use-toast';
import { Ticket } from './useTickets';

export const useOptimisticTicketActions = () => {
  const { user } = useAuth();
  const { userEquipes } = useUserEquipes();
  const { toast } = useToast();

  const updateOptimisticTicket = useCallback((
    ticketId: string,
    actionType: 'move' | 'take_ticket' | 'escalate',
    prevTickets: Ticket[],
    toStatus?: string,
    beforeId?: string,
    afterId?: string
  ): Ticket[] => {
    if (!user) {
      console.warn('User not authenticated, cannot perform optimistic update.');
      return prevTickets;
    }

    const userEquipeIds = userEquipes.map(eq => eq.id);

    switch (actionType) {
      case 'move':
        return prevTickets.map(ticket =>
          ticket.id === ticketId
            ? { ...ticket, status: toStatus as any, updated_at: new Date().toISOString() }
            : ticket
        );

      case 'take_ticket':
        return prevTickets.map(ticket => 
          ticket.id === ticketId 
            ? { 
                ...ticket, 
                status: 'em_atendimento' as const,
                equipe_responsavel_id: userEquipeIds[0] || ticket.equipe_responsavel_id,
                updated_at: new Date().toISOString()
              }
            : ticket
        );

      case 'escalate':
        return prevTickets.map(ticket =>
          ticket.id === ticketId
            ? {
              ...ticket,
              status: 'escalonado' as const,
              escalonamento_nivel: (ticket.escalonamento_nivel || 0) + 1,
              updated_at: new Date().toISOString()
            }
            : ticket
        );

      default:
        console.warn('Unknown action type, returning previous tickets.');
        return prevTickets;
    }
  }, [user, userEquipes]);

  return { updateOptimisticTicket };
};
