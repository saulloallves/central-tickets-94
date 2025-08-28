import { useEffect } from 'react';
import { useEnhancedTicketRealtime } from './useEnhancedTicketRealtime';
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
  onTicketDelete,
  filters
}: UseTicketsRealtimeProps) => {
  
  // Use the enhanced realtime hook
  const { isConnected } = useEnhancedTicketRealtime({
    onTicketUpdate,
    onTicketInsert,
    onTicketDelete,
    filters
  });

  return {
    isConnected
  };
};