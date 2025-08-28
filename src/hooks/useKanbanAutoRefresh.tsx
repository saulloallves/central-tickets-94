import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AutoRefreshOptions {
  onRefresh: () => void;
  onNewTickets?: (count: number) => void;
  enabled: boolean;
  intervalMs?: number;
}

export const useKanbanAutoRefresh = ({
  onRefresh,
  onNewTickets,
  enabled,
  intervalMs = 5000
}: AutoRefreshOptions) => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdatedRef = useRef<string>(new Date().toISOString());
  const realtimeChannelRef = useRef<any>(null);

  // Polling function that checks for any changes
  const checkForUpdates = useCallback(async () => {
    if (!user || !enabled) return;

    try {
      console.log('🔄 KANBAN: Checking for updates...');
      
      // Check if there are any tickets updated since last check
      const { data: recentTickets, error } = await supabase
        .from('tickets')
        .select('id, updated_at, codigo_ticket, status')
        .gte('updated_at', lastUpdatedRef.current)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ KANBAN: Error checking updates:', error);
        return;
      }

      if (recentTickets && recentTickets.length > 0) {
        console.log(`✅ KANBAN: Found ${recentTickets.length} updates, refreshing...`);
        lastUpdatedRef.current = new Date().toISOString();
        
        // Notify about new tickets if callback provided
        if (onNewTickets) {
          onNewTickets(recentTickets.length);
        }
        
        onRefresh();
      } else {
        console.log('📭 KANBAN: No updates found');
      }
    } catch (error) {
      console.error('❌ KANBAN: Update check error:', error);
    }
  }, [user, enabled, onRefresh, onNewTickets]);

  // Set up realtime as bonus (if it works)
  useEffect(() => {
    if (!enabled || !user) return;

    const channel = supabase
      .channel('kanban-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('🔄 KANBAN REALTIME: Event received, refreshing immediately');
          onRefresh();
        }
      )
      .subscribe((status) => {
        console.log('📡 KANBAN REALTIME: Status:', status);
      });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [enabled, user, onRefresh]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !user) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    console.log(`🔄 KANBAN: Starting auto-refresh every ${intervalMs}ms`);
    
    // Do an initial check
    checkForUpdates();
    
    // Set up interval
    intervalRef.current = setInterval(checkForUpdates, intervalMs);

    return () => {
      if (intervalRef.current) {
        console.log('🔌 KANBAN: Stopping auto-refresh');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, user, intervalMs, checkForUpdates]);

  return {
    isPolling: enabled && !!intervalRef.current
  };
};