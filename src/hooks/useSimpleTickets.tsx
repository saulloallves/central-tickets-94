import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Ticket } from './useTickets';

interface TicketFilters {
  search: string;
  status: string;
  categoria: string;
  prioridade: string;
  unidade_id: string;
  status_sla: string;
  equipe_id: string;
}

export const useSimpleTickets = (filters: TicketFilters) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeRef = useRef<any>(null);

  // ✅ FASE 2: Fetch tickets from view tickets_with_realtime_sla
  const fetchTickets = useCallback(async () => {
    if (!user) return;

    try {
      console.log('🔄 [FASE 2] Buscando tickets da view tickets_with_sla_info');
      
      // ✅ Usar view que já calcula SLA em tempo real
      let query = supabase
        .from('tickets_with_sla_info')
        .select(`
          *,
          unidades (id, grupo, cidade, uf),
          colaboradores (nome_completo),
          equipes (id, nome)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status as any);
      }
      if (filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria as any);
      }
      if (filters.prioridade !== 'all') {
        query = query.eq('prioridade', filters.prioridade as any);
      }
      if (filters.unidade_id !== 'all') {
        query = query.eq('unidade_id', filters.unidade_id);
      }
      if (filters.status_sla !== 'all') {
        query = query.eq('status_sla_calculado', filters.status_sla as any);
      }
      if (filters.equipe_id !== 'all') {
        query = query.eq('equipe_responsavel_id', filters.equipe_id);
      }
      if (filters.search) {
        query = query.or(`codigo_ticket.ilike.%${filters.search}%,descricao_problema.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [FASE 2] Error fetching tickets:', error);
        return;
      }

      console.log(`✅ [FASE 2] Tickets fetched from view: ${(data || []).length}`);
      setTickets((data || []) as unknown as Ticket[]);
    } catch (error) {
      console.error('❌ [FASE 2] Error in fetchTickets:', error);
    } finally {
      setLoading(false);
    }
  }, [user, filters]);

  // Setup simple realtime
  const setupRealtime = useCallback(() => {
    if (!user) return;

    console.log('🔄 Setting up simple realtime');

    // Clean up existing
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current);
    }

    const channel = supabase
      .channel('simple-tickets-mirror')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          console.log('📡 Database change:', payload.eventType);
          // Refetch to keep as exact mirror
          fetchTickets();
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
      });

    realtimeRef.current = channel;
  }, [user, fetchTickets]);

  // Initialize
  useEffect(() => {
    fetchTickets().then(() => {
      setupRealtime();
    });

    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
      }
    };
  }, [fetchTickets, setupRealtime]);

  return {
    tickets,
    loading,
    refetch: fetchTickets
  };
};
