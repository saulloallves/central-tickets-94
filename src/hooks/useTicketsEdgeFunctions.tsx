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
  const isDragging = useRef<boolean>(false);
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const backupPollingRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMovesRef = useRef<Set<string>>(new Set());

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

  // Setup realtime subscription with better error handling
  const setupRealtime = useCallback(() => {
    if (!user) return;

    console.log('🔄 Setting up ROBUST realtime subscription for tickets');
    
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channelName = `tickets-realtime-${user.id}`;
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          console.log('🔄 REALTIME EVENT RECEIVED:', {
            event: payload.eventType,
            table: payload.table,
            schema: payload.schema,
            new: payload.new ? { id: (payload.new as any)?.id, codigo_ticket: (payload.new as any)?.codigo_ticket } : null,
            old: payload.old ? { id: (payload.old as any)?.id, codigo_ticket: (payload.old as any)?.codigo_ticket } : null
          });
          
          // PATCH REALTIME UPDATES WITHOUT REFETCH - eliminates flicker
          if (payload.eventType === 'INSERT' && payload.new) {
            const newTicket = payload.new as Ticket;
            console.log('➕ REALTIME INSERT - Patching new ticket:', newTicket.codigo_ticket);
            setTickets(prev => {
              const exists = prev.find(t => t.id === newTicket.id);
              if (!exists) {
                return [...prev, newTicket].sort((a, b) => {
                  if (a.status !== b.status) {
                    const statusOrder = ['aberto', 'em_atendimento', 'escalonado', 'concluido'];
                    return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
                  }
                  return (a.position || 0) - (b.position || 0);
                });
              }
              return prev;
            });
            return;
          }
          
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedTicket = payload.new as Ticket;
            
            // Skip if this is a pending optimistic move to prevent conflicts
            if (pendingMovesRef.current.has(updatedTicket.id)) {
              console.log('🚫 Skipping realtime update for pending optimistic move:', updatedTicket.codigo_ticket);
              return;
            }
            
            console.log('🔄 REALTIME UPDATE - Patching ticket:', updatedTicket.codigo_ticket);
            setTickets(prev => prev.map(ticket => 
              ticket.id === updatedTicket.id ? updatedTicket : ticket
            ));
            return;
          }
          
          if (payload.eventType === 'DELETE' && payload.old) {
            const deletedTicket = payload.old as Ticket;
            console.log('🗑️ REALTIME DELETE - Removing ticket:', deletedTicket.codigo_ticket);
            setTickets(prev => prev.filter(ticket => ticket.id !== deletedTicket.id));
            return;
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to tickets realtime');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error in realtime subscription');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Realtime subscription timed out');
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Realtime subscription closed');
        }
      });

    realtimeChannelRef.current = channel;
    
    // Set up periodic polling as backup if realtime fails
    const pollInterval = setInterval(() => {
      console.log('🔄 Backup polling triggered');
      fetchTickets();
    }, 30000); // Poll every 30 seconds as backup

    return () => {
      clearInterval(pollInterval);
    };
  }, [user, fetchTickets]);

  // Initial setup with better lifecycle management
  useEffect(() => {
    if (user && !roleLoading && !fetchedRef.current) {
      console.log('🚀 Initializing tickets system for user:', user.id);
      fetchedRef.current = true;
      fetchTickets();
      
      // Set up realtime after initial fetch
      const cleanup = setupRealtime();
      
      return cleanup;
    }
  }, [user, roleLoading, fetchTickets, setupRealtime]);

  // Filter-based refetch with improved debouncing
  useEffect(() => {
    if (user && !roleLoading && fetchedRef.current) {
      console.log('🔍 Filters changed, debouncing refetch:', filters);
      const timeoutId = setTimeout(() => {
        console.log('🔍 Executing filter-based refetch');
        fetchTickets();
      }, 300);
      
      return () => {
        console.log('🔍 Cancelling debounced refetch');
        clearTimeout(timeoutId);
      };
    }
  }, [filters, user, roleLoading, fetchTickets]);

  // Recalculate stats when tickets change
  useEffect(() => {
    calculateStats(tickets);
  }, [tickets, calculateStats]);

  // Enhanced cleanup
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up tickets realtime subscription');
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
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
      console.log('📤 Creating ticket via edge function:', ticketData);
      
      const { data, error } = await supabase.functions.invoke('create-ticket', {
        body: ticketData,
      });

      if (error) {
        console.error('❌ Edge function error creating ticket:', error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao criar ticket",
          variant: "destructive",
        });
        return null;
      }

      console.log('✅ Ticket created successfully via edge function:', data);
      toast({
        title: "Sucesso", 
        description: data.message || "Ticket criado com sucesso",
      });

      // Force immediate refetch to ensure UI consistency
      console.log('🔄 Force refetching tickets after creation');
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
      console.log('📤 Updating ticket via edge function:', ticketId, updates);
      
      const { data, error } = await supabase.functions.invoke('update-ticket', {
        body: { ticketId, updates },
      });

      if (error) {
        console.error('❌ Edge function error updating ticket:', error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao atualizar ticket",
          variant: "destructive",
        });
        return null;
      }

      console.log('✅ Ticket updated successfully via edge function:', data);
      
      // Force immediate refetch to ensure UI consistency
      console.log('🔄 Force refetching tickets after update');
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
      console.log('📤 Deleting ticket via edge function:', ticketId);
      
      const { data, error } = await supabase.functions.invoke('delete-ticket', {
        body: { ticketId },
      });

      if (error) {
        console.error('❌ Edge function error deleting ticket:', error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao deletar ticket",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Ticket deleted successfully via edge function:', data);
      toast({
        title: "Sucesso",
        description: data.message || "Ticket deletado com sucesso",
      });

      // Force immediate refetch to ensure UI consistency
      console.log('🔄 Force refetching tickets after deletion');
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

  const moveTicket = async (ticketId: string, toStatus: string, beforeId?: string, afterId?: string): Promise<boolean> => {
    try {
      console.log('📤 Moving ticket via edge function:', { ticketId, toStatus, beforeId, afterId });
      
      // Add to pending moves to prevent realtime conflicts
      pendingMovesRef.current.add(ticketId);
      
      const { data, error } = await supabase.functions.invoke('move-ticket', {
        body: { ticketId, toStatus, beforeId, afterId },
      });

      // Remove from pending regardless of success/failure
      pendingMovesRef.current.delete(ticketId);

      if (error) {
        console.error('❌ Edge function error moving ticket:', error);
        return false;
      }

      console.log('✅ Ticket moved successfully via edge function:', data);
      
      toast({
        title: "Sucesso",
        description: "Ticket movido com sucesso",
      });
      
      // No refetch needed - realtime patches will handle it
      return true;
    } catch (error) {
      console.error('Error moving ticket:', error);
      // Remove from pending on error
      pendingMovesRef.current.delete(ticketId);
      return false;
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
    setDragStatus: (dragging: boolean) => { isDragging.current = dragging; },
  };
};