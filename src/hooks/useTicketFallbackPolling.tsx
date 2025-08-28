import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Ticket } from './useTickets';

interface TicketPollingOptions {
  onNewTickets: (tickets: Ticket[]) => void;
  enabled: boolean;
  intervalMs?: number;
  filters?: {
    unidade_id?: string;
    equipe_id?: string;
    status?: string[];
  };
}

export const useTicketFallbackPolling = ({
  onNewTickets,
  enabled,
  intervalMs = 5000,
  filters
}: TicketPollingOptions) => {
  const { user } = useAuth();
  const lastSeenTimestampRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pollForNewTickets = useCallback(async () => {
    if (!user || !enabled) return;

    try {
      console.log('🔄 FALLBACK: Polling for new tickets...');
      
      let query = supabase
        .from('tickets')
        .select('*')
        .order('data_abertura', { ascending: false });

      // Apply timestamp filter if we have a last seen timestamp
      if (lastSeenTimestampRef.current) {
        query = query.gt('data_abertura', lastSeenTimestampRef.current);
      } else {
        // First time - only get tickets from last 5 minutes to avoid overwhelming
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        query = query.gte('data_abertura', fiveMinutesAgo);
      }

      // Apply filters
      if (filters?.unidade_id) {
        query = query.eq('unidade_id', filters.unidade_id);
      }
      if (filters?.equipe_id) {
        query = query.eq('equipe_responsavel_id', filters.equipe_id);
      }
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status as any);
      }

      const { data: newTickets, error } = await query.limit(10);

      if (error) {
        console.error('❌ FALLBACK: Error polling tickets:', error);
        return;
      }

      if (newTickets && newTickets.length > 0) {
        console.log(`✅ FALLBACK: Found ${newTickets.length} new tickets`);
        
        // Update the last seen timestamp to the most recent ticket
        lastSeenTimestampRef.current = newTickets[0].data_abertura;
        
        // Call the handler with new tickets
        onNewTickets(newTickets as Ticket[]);
      } else {
        console.log('📭 FALLBACK: No new tickets found');
      }
    } catch (error) {
      console.error('❌ FALLBACK: Polling error:', error);
    }
  }, [user, enabled, filters, onNewTickets]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !user) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    console.log(`🔄 FALLBACK: Starting polling every ${intervalMs}ms`);
    
    // Do an initial poll
    pollForNewTickets();
    
    // Set up interval
    pollingIntervalRef.current = setInterval(pollForNewTickets, intervalMs);

    return () => {
      if (pollingIntervalRef.current) {
        console.log('🔌 FALLBACK: Stopping polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [enabled, user, intervalMs, pollForNewTickets]);

  // Initialize timestamp on mount
  useEffect(() => {
    if (enabled && !lastSeenTimestampRef.current) {
      lastSeenTimestampRef.current = new Date().toISOString();
      console.log('⏰ FALLBACK: Initialized timestamp:', lastSeenTimestampRef.current);
    }
  }, [enabled]);

  return {
    isPolling: enabled && !!pollingIntervalRef.current
  };
};