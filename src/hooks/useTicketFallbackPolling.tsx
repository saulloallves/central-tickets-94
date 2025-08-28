import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Ticket } from './useTickets';

interface TicketPollingOptions {
  onNewTickets: (tickets: Ticket[]) => void;
  onUpdatedTickets?: (tickets: Ticket[]) => void;
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
  onUpdatedTickets,
  enabled,
  intervalMs = 5000,
  filters
}: TicketPollingOptions) => {
  const { user } = useAuth();
  const lastSeenCreatedAtRef = useRef<string | null>(null);
  const lastSeenUpdatedAtRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pollForTickets = useCallback(async () => {
    if (!user || !enabled) return;

    try {
      console.log('🔄 FALLBACK: Polling for new and updated tickets...');
      
      // Base query with joins
      const baseQuery = supabase
        .from('tickets')
        .select(`
          *,
          equipes!equipe_responsavel_id(nome),
          unidades(id, grupo, cidade, uf),
          colaboradores(nome_completo)
        `);

      // Poll for NEW tickets (INSERT)
      let newQuery = baseQuery.order('data_abertura', { ascending: false });
      
      if (lastSeenCreatedAtRef.current) {
        newQuery = newQuery.gt('data_abertura', lastSeenCreatedAtRef.current);
      } else {
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        newQuery = newQuery.gte('data_abertura', twoMinutesAgo);
      }

      // Apply filters for new tickets
      if (filters?.unidade_id) {
        newQuery = newQuery.eq('unidade_id', filters.unidade_id);
      }
      if (filters?.equipe_id) {
        newQuery = newQuery.eq('equipe_responsavel_id', filters.equipe_id);
      }
      if (filters?.status && filters.status.length > 0) {
        newQuery = newQuery.in('status', filters.status as any);
      }

      const { data: newTickets, error: newError } = await newQuery.limit(10);

      if (newError) {
        console.error('❌ FALLBACK: Error polling new tickets:', newError);
      } else if (newTickets && newTickets.length > 0) {
        console.log(`✅ FALLBACK: Found ${newTickets.length} new tickets`);
        lastSeenCreatedAtRef.current = newTickets[0].data_abertura;
        onNewTickets(newTickets as any);
      }

      // Poll for UPDATED tickets (if callback provided)
      if (onUpdatedTickets) {
        let updateQuery = baseQuery.order('updated_at', { ascending: false });
        
        if (lastSeenUpdatedAtRef.current) {
          updateQuery = updateQuery.gt('updated_at', lastSeenUpdatedAtRef.current);
        } else {
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
          updateQuery = updateQuery.gte('updated_at', twoMinutesAgo);
        }

        // Apply same filters for updated tickets
        if (filters?.unidade_id) {
          updateQuery = updateQuery.eq('unidade_id', filters.unidade_id);
        }
        if (filters?.equipe_id) {
          updateQuery = updateQuery.eq('equipe_responsavel_id', filters.equipe_id);
        }

        const { data: updatedTickets, error: updateError } = await updateQuery.limit(20);

        if (updateError) {
          console.error('❌ FALLBACK: Error polling updated tickets:', updateError);
        } else if (updatedTickets && updatedTickets.length > 0) {
          // Filter out tickets that were already handled as "new" to avoid duplicates
          const newTicketIds = new Set(newTickets?.map(t => t.id) || []);
          const reallyUpdated = updatedTickets.filter(t => !newTicketIds.has(t.id));
          
          if (reallyUpdated.length > 0) {
            console.log(`✅ FALLBACK: Found ${reallyUpdated.length} updated tickets`);
            lastSeenUpdatedAtRef.current = updatedTickets[0].updated_at;
            onUpdatedTickets(reallyUpdated as any);
          }
        }
      }
    } catch (error) {
      console.error('❌ FALLBACK: Polling error:', error);
    }
  }, [user, enabled, filters, onNewTickets, onUpdatedTickets]);

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
    pollForTickets();
    
    // Set up interval
    pollingIntervalRef.current = setInterval(pollForTickets, intervalMs);

    return () => {
      if (pollingIntervalRef.current) {
        console.log('🔌 FALLBACK: Stopping polling');
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [enabled, user, intervalMs, pollForTickets]);

  // Initialize timestamps on mount
  useEffect(() => {
    if (enabled && !lastSeenCreatedAtRef.current) {
      const now = new Date().toISOString();
      lastSeenCreatedAtRef.current = now;
      lastSeenUpdatedAtRef.current = now;
      console.log('⏰ FALLBACK: Initialized timestamps:', now);
    }
  }, [enabled]);

  return {
    isPolling: enabled && !!pollingIntervalRef.current
  };
};