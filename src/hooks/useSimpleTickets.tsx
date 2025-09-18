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

  // Fetch tickets from database
  const fetchTickets = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          unidades!fk_tickets_unidade (id, grupo, cidade, uf),
          colaboradores!fk_tickets_colaborador (nome_completo),
          equipes!fk_tickets_equipe_responsavel (id, nome),
          atendimento_iniciado_por_profile:profiles!tickets_atendimento_iniciado_por_fkey(nome_completo),
          created_by_profile:profiles!tickets_criado_por_fkey(nome_completo),
          crise_links:crise_ticket_links!crise_ticket_links_ticket_id_fkey(
            id,
            crises!crise_ticket_links_crise_id_fkey(id, is_active, status)
          )
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
        query = query.eq('status_sla', filters.status_sla as any);
      }
      if (filters.equipe_id !== 'all') {
        query = query.eq('equipe_responsavel_id', filters.equipe_id);
      }
      if (filters.search) {
        query = query.or(`codigo_ticket.ilike.%${filters.search}%,descricao_problema.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        return;
      }

      // Filter out crisis tickets if needed
      const visibleTickets = (data || []).filter((ticket: any) => {
        if (!ticket.crise_links || ticket.crise_links.length === 0) {
          return true;
        }
        return !ticket.crise_links.some((link: any) => 
          link.crises && link.crises.is_active
        );
      });

      console.log('Tickets fetched:', visibleTickets.length);
      setTickets(visibleTickets as unknown as Ticket[]);
    } catch (error) {
      console.error('Error in fetchTickets:', error);
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
