import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useRole } from './useRole';
import { useToast } from '@/hooks/use-toast';
import { useUserEquipes } from './useUserEquipes';

export interface Ticket {
  id: string;
  codigo_ticket: string;
  titulo?: string;
  unidade_id: string;
  franqueado_id?: number;
  colaborador_id?: string;
  descricao_problema: string;
  canal_origem: 'typebot' | 'whatsapp_zapi' | 'web';
  status: 'aberto' | 'em_atendimento' | 'escalonado' | 'concluido';
  categoria?: 'juridico' | 'sistema' | 'midia' | 'operacoes' | 'rh' | 'financeiro' | 'outro';
  subcategoria?: string;
  prioridade: 'imediato' | 'ate_1_hora' | 'ainda_hoje' | 'posso_esperar' | 'crise';
  data_abertura: string;
  data_limite_sla?: string;
  equipe_responsavel_id?: string;
  escalonado_para?: string;
  status_sla: 'dentro_prazo' | 'alerta' | 'vencido';
  resolvido_em?: string;
  resposta_resolucao?: string;
  canal_resposta?: 'web' | 'whatsapp' | 'typebot' | 'interno';
  arquivos: any[];
  criado_por?: string;
  log_ia: any;
  reaberto_count: number;
  atendimento_iniciado_por?: string;
  atendimento_iniciado_em?: string;
  created_at: string;
  updated_at: string;
  position?: number;
  // Relations
  unidades?: { id: string; grupo: string; cidade?: string; uf?: string };
  colaboradores?: { nome_completo: string };
  equipes?: { id: string; nome: string };
  atendimento_iniciado_por_profile?: { nome_completo: string };
  created_by_profile?: { nome_completo: string };
}

export interface TicketFilters {
  search: string;
  status: string;
  categoria: string;
  prioridade: string;
  unidade_id: string;
  status_sla: string;
  equipe_id: string;
}

export interface TicketStats {
  total: number;
  novos: number;
  sla_vencido: number;
  em_atendimento: number;
  tempo_medio: number;
}

export const useTicketsEdgeFunctions = (filters: TicketFilters) => {
  const { user } = useAuth();
  const { isAdmin, isSupervisor, loading: roleLoading } = useRole();
  const { userEquipes } = useUserEquipes();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);
  const realtimeChannelRef = useRef<any>(null);

  // Fetch tickets using regular supabase query (read-only)
  const fetchTickets = useCallback(async () => {
    if (!user || roleLoading) return;
    
    try {
      setLoading(true);
      
      let query = supabase
        .from('tickets')
        .select(`
          *,
          equipes!equipe_responsavel_id(nome),
          unidades(id, grupo, cidade, uf),
          colaboradores(nome_completo)
        `)
        .order('status', { ascending: true })
        .order('position', { ascending: true });

      // Apply filters
      if (filters.search) {
        query = query.or(`codigo_ticket.ilike.%${filters.search}%,descricao_problema.ilike.%${filters.search}%,titulo.ilike.%${filters.search}%`);
      }
      if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status as any);
      if (filters.categoria && filters.categoria !== 'all') query = query.eq('categoria', filters.categoria as any);
      if (filters.prioridade && filters.prioridade !== 'all') query = query.eq('prioridade', filters.prioridade as any);
      if (filters.status_sla && filters.status_sla !== 'all') query = query.eq('status_sla', filters.status_sla as any);
      if (filters.unidade_id && filters.unidade_id !== 'all') query = query.eq('unidade_id', filters.unidade_id);
      
      if (filters.equipe_id && filters.equipe_id !== 'all') {
        if (filters.equipe_id === 'minhas_equipes') {
          const userEquipeIds = userEquipes.map(ue => ue.equipe_id);
          if (userEquipeIds.length > 0) {
            query = query.in('equipe_responsavel_id', userEquipeIds);
          } else {
            query = query.eq('equipe_responsavel_id', 'none');
          }
        } else {
          query = query.eq('equipe_responsavel_id', filters.equipe_id);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os tickets",
          variant: "destructive",
        });
        return;
      }

      console.log('Tickets fetched successfully:', data?.length || 0);
      setTickets((data as any) || []);
      
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, roleLoading, filters, userEquipes, toast]);

  // Calculate stats from current tickets
  const calculateStats = useCallback((ticketsList: Ticket[]) => {
    const today = new Date().toISOString().split('T')[0];
    const todaysTickets = ticketsList.filter(t => {
      const ticketDate = new Date(t.data_abertura).toISOString().split('T')[0];
      return ticketDate === today;
    });
    
    const stats: TicketStats = {
      total: todaysTickets.length,
      novos: todaysTickets.length,
      sla_vencido: todaysTickets.filter(t => t.status_sla === 'vencido').length,
      em_atendimento: todaysTickets.filter(t => t.status === 'em_atendimento').length,
      tempo_medio: 0
    };

    const resolvedTodayTickets = todaysTickets.filter(t => t.resolvido_em);
    if (resolvedTodayTickets.length > 0) {
      const totalHours = resolvedTodayTickets.reduce((acc, ticket) => {
        const opened = new Date(ticket.data_abertura);
        const resolved = new Date(ticket.resolvido_em!);
        const hours = (resolved.getTime() - opened.getTime()) / (1000 * 60 * 60);
        return acc + hours;
      }, 0);
      stats.tempo_medio = totalHours / resolvedTodayTickets.length;
    }

    setTicketStats(stats);
  }, []);

  // Setup realtime subscription
  const setupRealtime = useCallback(() => {
    if (!user) return;

    console.log('🔄 Setting up realtime subscription for tickets');
    
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          console.log('🔄 Realtime event received:', payload.eventType, payload);
          
          // Refetch tickets on any change to ensure consistency
          fetchTickets();
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
      });

    realtimeChannelRef.current = channel;
  }, [user, fetchTickets]);

  // Initial fetch
  useEffect(() => {
    if (user && !roleLoading && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchTickets();
      setupRealtime();
    }
  }, [user, roleLoading, fetchTickets, setupRealtime]);

  // Filter-based refetch with debounce
  useEffect(() => {
    if (user && !roleLoading && fetchedRef.current) {
      const timeoutId = setTimeout(() => {
        fetchTickets();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [filters, user, roleLoading, fetchTickets]);

  // Recalculate stats when tickets change
  useEffect(() => {
    calculateStats(tickets);
  }, [tickets, calculateStats]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, []);

  // Edge function operations
  const createTicket = async (ticketData: Partial<Ticket>) => {
    if (!user?.id) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-ticket', {
        body: ticketData,
      });

      if (error) {
        console.error('Error creating ticket:', error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao criar ticket",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Sucesso",
        description: data.message || "Ticket criado com sucesso",
      });

      // Refresh tickets after creation
      await fetchTickets();
      return data.ticket;
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao criar ticket",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    try {
      const { data, error } = await supabase.functions.invoke('update-ticket', {
        body: { ticketId, updates },
      });

      if (error) {
        console.error('Error updating ticket:', error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao atualizar ticket",
          variant: "destructive",
        });
        return null;
      }

      // Refresh tickets after update
      await fetchTickets();
      return data.ticket;
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao atualizar ticket",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteTicket = async (ticketId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-ticket', {
        body: { ticketId },
      });

      if (error) {
        console.error('Error deleting ticket:', error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao deletar ticket",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Sucesso",
        description: data.message || "Ticket deletado com sucesso",
      });

      // Refresh tickets after deletion
      await fetchTickets();
      return true;
    } catch (error) {
      console.error('Error deleting ticket:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao deletar ticket",
        variant: "destructive",
      });
      return false;
    }
  };

  const moveTicket = async (ticketId: string, toStatus: string, beforeId?: string, afterId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('move-ticket', {
        body: { ticketId, toStatus, beforeId, afterId },
      });

      if (error) {
        console.error('Error moving ticket:', error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao mover ticket",
          variant: "destructive",
        });
        return null;
      }

      // Refresh tickets after move
      await fetchTickets();
      return data.ticket;
    } catch (error) {
      console.error('Error moving ticket:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao mover ticket",
        variant: "destructive",
      });
      return null;
    }
  };

  return {
    tickets,
    loading,
    ticketStats,
    refetch: fetchTickets,
    createTicket,
    updateTicket,
    deleteTicket,
    moveTicket,
  };
};