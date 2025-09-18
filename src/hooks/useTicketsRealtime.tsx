import { useSimpleTicketsRealtime } from './useSimpleTicketsRealtime';
import { Ticket } from './useTickets';

interface UseTicketsRealtimeProps {
  onTicketUpdate: (ticket: Ticket) => void;
  onTicketInsert: (ticket: Ticket) => void;
  onTicketDelete: (ticketId: string) => void;
  filters?: {
    unidade_id?: string;
    equipe_id?: string;
    status?: string[];
  };
}

export const useTicketsRealtime = ({
  onTicketUpdate,
  onTicketInsert,
  onTicketDelete
}: Omit<UseTicketsRealtimeProps, 'filters'>) => {
  
  // Use simple realtime - direct mirror of database
  const { isConnected } = useSimpleTicketsRealtime({
    onTicketUpdate,
    onTicketInsert,
    onTicketDelete
  });

  return {
    isConnected
  };
};