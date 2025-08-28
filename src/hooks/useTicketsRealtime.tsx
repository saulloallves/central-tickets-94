
import { useRealtimeTickets } from './useRealtimeTickets';

// Simple wrapper for backward compatibility
export const useTicketsRealtime = (options: any) => {
  return useRealtimeTickets(options);
};
