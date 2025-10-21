import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useRole } from './useRole';
import { useToast } from '@/hooks/use-toast';
import { useUserEquipes } from './useUserEquipes';
import { NotificationSounds } from '@/lib/notification-sounds';

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
  prioridade: 'baixo' | 'medio' | 'alto' | 'imediato' | 'crise';
  data_abertura: string;
  data_limite_sla?: string;
  sla_pausado?: boolean;
  sla_pausado_mensagem?: boolean;
  sla_pausado_horario?: boolean;
  sla_pausado_em?: string;
  tempo_pausado_total?: string;
  sla_minutos_restantes?: number;
  sla_minutos_totais?: number;
  sla_ultima_atualizacao?: string;
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
  crise_links?: Array<{
    id: string;
    crises?: {
      id: string;
      is_active: boolean;
      status: string;
    } | null;
  }>;
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
  const [lastUpdate, setLastUpdate] = useState(Date.now()); // Força re-renders
  const fetchedRef = useRef(false);
  const realtimeChannelRef = useRef<any>(null);
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const backupPollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateThrottle = useRef<number>(0);
  const reconnectAttemptsRef = useRef<number>(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Fetch tickets using regular supabase query (read-only) with retry logic
  const fetchTickets = useCallback(async (isRefetch = false, retryCount = 0) => {
    if (!user || roleLoading) return;
    
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff
    
    try {
      // Only set loading on initial fetch, not on refetches
      if (!isRefetch) {
        setLoading(true);
      }
      
      let query = supabase
        .from('tickets')
        .select(`
          *,
          equipes:equipe_responsavel_id(id, nome),
          unidades(id, grupo, cidade, uf),
          colaboradores(nome_completo),
          crise_links:crise_ticket_links!left(
            id,
            crises!left(
              id,
              is_active,
              status
            )
          )
        `)
        .order('data_abertura', { ascending: false }); // Mais novos no topo

      // Apply filters (search filter is done client-side to include unit name)
      // Removed backend search filter to allow client-side filtering with unidades.grupo
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
        throw error;
      }

      const allTickets = (data as any) || [];
      console.log('📦 PASSO 1: Tickets do banco:', allTickets.length);
      
      // ⬇️ FILTRO CLIENT-SIDE AMPLIADO - Busca em TODOS os campos
      let filteredTickets = allTickets;

      if (filters.search && filters.search.trim()) {
        const searchLower = filters.search.toLowerCase().trim();
        console.log('🔍 Aplicando filtro de busca:', searchLower);
        
        filteredTickets = allTickets.filter((ticket: any) => {
          // Campos básicos do ticket
          const codigo = ticket.codigo_ticket?.toLowerCase() || '';
          const titulo = ticket.titulo?.toLowerCase() || '';
          const descricao = ticket.descricao_problema?.toLowerCase() || '';
          
          // Dados da unidade
          const unidadeNome = ticket.unidades?.grupo?.toLowerCase() || '';
          const unidadeCidade = ticket.unidades?.cidade?.toLowerCase() || '';
          const unidadeUF = ticket.unidades?.uf?.toLowerCase() || '';
          
          // Dados do colaborador
          const colaboradorNome = ticket.colaboradores?.nome_completo?.toLowerCase() || '';
          
          // Buscar em TODOS os campos
          const match = (
            codigo.includes(searchLower) ||
            titulo.includes(searchLower) ||
            descricao.includes(searchLower) ||
            unidadeNome.includes(searchLower) ||
            unidadeCidade.includes(searchLower) ||
            unidadeUF.includes(searchLower) ||
            colaboradorNome.includes(searchLower)
          );
          
          return match;
        });
        
        console.log(`🔍 PASSO 2: Após filtro de busca: ${filteredTickets.length} tickets (de ${allTickets.length})`);
      }
      
      // Debug: Log newest tickets (create copy to avoid mutation)
      const sortedByDate = [...filteredTickets].sort((a: any, b: any) => 
        new Date(b.data_abertura).getTime() - new Date(a.data_abertura).getTime()
      );
      if (sortedByDate.length > 0) {
        console.log('🆕 Most recent tickets:', sortedByDate.slice(0, 3).map((t: any) => ({
          id: t.id,
          codigo: t.codigo_ticket,
          created: t.data_abertura,
          hasCreatedInLast5Min: (Date.now() - new Date(t.data_abertura).getTime()) < 5 * 60 * 1000
        })));
      }
      
      // Filter out tickets that are linked to active crises
      const visibleTickets = filteredTickets.filter((ticket: any) => {
        // If ticket has no crisis links, show it
        if (!ticket.crise_links || ticket.crise_links.length === 0) {
          return true;
        }
        
        // Hide ticket if it's linked to any active crisis
        const hasActiveCrisis = ticket.crise_links.some((link: any) => 
          link.crises && link.crises.is_active
        );
        
        return !hasActiveCrisis;
      });
      
      console.log('🚫 PASSO 3: Após filtro de crises:', visibleTickets.length);

      // ⬇️ VALIDAÇÃO: Alertar se o filtro de busca resultou em 0 tickets
      if (visibleTickets.length === 0 && filters.search && filters.search.trim()) {
        console.warn('⚠️ ATENÇÃO: Filtro de busca resultou em 0 tickets!');
        console.warn('🔍 Termo buscado:', filters.search);
        console.warn('📊 Tickets antes da busca:', allTickets.length);
      }

      console.log('✅ PASSO 4: Tickets enviados ao Kanban:', visibleTickets.length);
      
      setTickets(visibleTickets);
      
      // Force immediate update for realtime responsiveness
      console.log('🔄 Setting lastUpdate to force Kanban re-render...');
      setLastUpdate(Date.now());
      
    } catch (error) {
      console.error('Error fetching tickets:', {
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : 'Unknown error',
        hint: '',
        code: ''
      });
      
      // Retry logic for network errors
      if (retryCount < maxRetries && 
          (error instanceof Error && 
           (error.message.includes('Failed to fetch') || 
            error.message.includes('NetworkError') ||
            error.message.includes('fetch')))) {
        
        console.log(`🔄 Retrying fetch tickets (attempt ${retryCount + 1}/${maxRetries}) in ${retryDelay}ms`);
        
        setTimeout(() => {
          fetchTickets(isRefetch, retryCount + 1);
        }, retryDelay);
        
        return;
      }
      
      // Only show toast error after all retries failed or for non-network errors
      if (retryCount >= maxRetries || !isRefetch) {
        toast({
          title: "Erro",
          description: retryCount >= maxRetries ? 
            "Não foi possível carregar os tickets após várias tentativas" :
            "Não foi possível carregar os tickets",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, roleLoading, JSON.stringify(filters), userEquipes, toast]);

  // Calculate stats from current tickets - memoized to prevent recreation
  const calculateStats = useCallback((ticketsList: Ticket[]) => {
    const today = new Date().toISOString().split('T')[0];
    const todaysTickets = ticketsList.filter(t => {
      const ticketDate = new Date(t.data_abertura).toISOString().split('T')[0];
      return ticketDate === today;
    });
    
    const stats: TicketStats = {
      total: todaysTickets.length,
      novos: todaysTickets.length,
      sla_vencido: ticketsList.filter(t => 
        t.status_sla === 'vencido' && 
        t.status !== 'concluido'
      ).length,
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
  }, []); // Empty deps - function is stable

  // Optimized realtime setup - single channel only
  const setupRealtime = useCallback(() => {
    if (!user) return;

    console.log('🔄 Setting up optimized realtime subscription for tickets');
    
    // Clean up existing subscription and reset reconnect counter
    if (realtimeChannelRef.current) {
      console.log('🧹 Removing old channel before creating new one');
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    
    // Reset reconnect attempts when setting up fresh
    reconnectAttemptsRef.current = 0;

    const channelName = `tickets-realtime-${user.id}-${Math.random().toString(36).substr(2, 9)}`;
    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        (payload) => {
          console.log('🚀 REALTIME EVENT:', {
            tipo: payload.eventType,
            ticket: (payload.new as any)?.codigo_ticket,
            status_anterior: (payload.old as any)?.status,
            status_novo: (payload.new as any)?.status,
            equipe_anterior: (payload.old as any)?.equipe_responsavel_id,
            equipe_nova: (payload.new as any)?.equipe_responsavel_id,
            usuario_causador: (payload.new as any)?.criado_por,
            usuario_atual: user.id,
            timestamp: new Date().toISOString()
          });
          
          // Handle new ticket notifications
          if (payload.eventType === 'INSERT' && payload.new) {
            const newTicket = payload.new as any;
            
            // Only play sound for tickets not created by current user
            if (newTicket.criado_por !== user.id) {
              console.log('🔊 Playing notification sound for new ticket:', newTicket.codigo_ticket);
              
              // Play sound based on priority
              if (newTicket.prioridade === 'crise' || newTicket.prioridade === 'imediato') {
                NotificationSounds.playCriticalAlert();
              } else if (newTicket.prioridade === 'alto') {
                NotificationSounds.playNotificationSound('warning');
              } else {
                NotificationSounds.playNotificationSound('info');
              }
              
              // Show toast notification
              toast({
                title: "🎫 Novo Ticket",
                description: `${newTicket.codigo_ticket} - ${newTicket.descricao_problema?.substring(0, 60)}...`,
                duration: 5000,
              });
            }
            
            // Dispatch custom event for Kanban as backup
            window.dispatchEvent(new CustomEvent('new-ticket-created', {
              detail: { ticket: newTicket }
            }));
          }
          
          // Para eventos INSERT, refetch imediatamente sem debounce para máxima responsividade
          if (payload.eventType === 'INSERT') {
            console.log('🎯 NOVO TICKET DETECTADO - Refetch imediato!');
            fetchTickets(true).then(() => {
              console.log('✅ Tickets refetched successfully after INSERT');
              // Force immediate update
              console.log('🔄 Forcing lastUpdate to trigger Kanban re-render');
              setLastUpdate(Date.now());
            });
          } else {
            // Para UPDATE e DELETE, refetch imediato sem debounce para sincronização instantânea
            console.log('🎯 UPDATE/DELETE DETECTADO - Refetch imediato para todos os usuários!');
            fetchTickets(true).then(() => {
              console.log('✅ Tickets atualizados após evento', payload.eventType);
              setLastUpdate(Date.now()); // Força re-render do Kanban
            });
          }
        }
      )
      // ✅ CRITICAL: Listen to ticket_mensagens to update SLA pause status in real-time
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_mensagens',
        },
        (payload) => {
          console.log('💬 MENSAGEM INSERIDA - Atualizando SLA pausado:', {
            ticket_id: (payload.new as any)?.ticket_id,
            direcao: (payload.new as any)?.direcao,
            timestamp: new Date().toISOString()
          });
          
          // Refetch immediately to get updated sla_pausado_mensagem flag
          fetchTickets(true).then(() => {
            console.log('✅ Tickets atualizados após nova mensagem - SLA pausado atualizado');
            setLastUpdate(Date.now()); // Force Kanban re-render
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to tickets realtime');
          // Reset reconnect attempts on successful connection
          reconnectAttemptsRef.current = 0;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error in realtime subscription');
          
          // Limitar tentativas de reconexão
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            console.log(`🔁 Retrying realtime connection (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            setTimeout(() => {
              setupRealtime();
            }, 3000);
          } else {
            console.error(`❌ Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnection.`);
          }
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Realtime subscription timed out');
          
          // Limitar tentativas de reconexão
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            console.log(`🔁 Retrying realtime connection (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            setTimeout(() => {
              setupRealtime();
            }, 3000);
          } else {
            console.error(`❌ Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnection.`);
          }
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Realtime subscription closed');
        }
      });

    realtimeChannelRef.current = channel;
    
    // REMOVED: Polling backup removed to improve performance
    // Realtime is reliable enough, if it fails, the reconnection logic handles it
  }, [user, fetchTickets]);

  // Simplified initialization - always fresh setup for realtime reliability
  useEffect(() => {
    if (!user || roleLoading) {
      console.log('🚫 Waiting for user and role loading...');
      return;
    }
    
    console.log('🚀 Initializing tickets system for user:', user.id);
    
    // Force fresh initialization each time for realtime reliability
    fetchedRef.current = false; // Reset to allow fetch
    
    const initialize = async () => {
      console.log('📊 Fetching fresh tickets...');
      await fetchTickets();
      console.log('📡 Setting up realtime connection...');
      setupRealtime();
    };
    
    initialize();
  }, [user?.id, roleLoading, JSON.stringify(filters)]); // Added filters to refetch when they change

  // Recalculate stats when tickets change
  useEffect(() => {
    calculateStats(tickets);
  }, [tickets, calculateStats]);

  // Listen for optimistic updates from TicketDetail
  useEffect(() => {
    const handleOptimisticUpdate = (event: CustomEvent) => {
      const { ticketId, updates } = event.detail;
      console.log('⚡ Received optimistic update from TicketDetail:', { ticketId, updates });
      
      setTickets(prev => prev.map(ticket => 
        ticket.id === ticketId ? { ...ticket, ...updates } : ticket
      ));
    };

    const handleOptimisticRollback = (event: CustomEvent) => {
      const { ticketId, originalStatus } = event.detail;
      console.log('🔄 Received optimistic rollback from TicketDetail:', { ticketId, originalStatus });
      
      setTickets(prev => prev.map(ticket => 
        ticket.id === ticketId ? { ...ticket, status: originalStatus } : ticket
      ));
    };

    window.addEventListener('ticket-optimistic-update', handleOptimisticUpdate as EventListener);
    window.addEventListener('ticket-optimistic-rollback', handleOptimisticRollback as EventListener);

    return () => {
      window.removeEventListener('ticket-optimistic-update', handleOptimisticUpdate as EventListener);
      window.removeEventListener('ticket-optimistic-rollback', handleOptimisticRollback as EventListener);
    };
  }, []);

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
      await fetchTickets(true);
      
      // Also force a last update timestamp to trigger Kanban re-render
      setLastUpdate(Date.now());
      
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
      await fetchTickets(true);
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
      await fetchTickets(true);
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
    console.log('🎯 [MOVE TICKET] Função chamada!', { ticketId, toStatus, beforeId, afterId });
    
    try {
      console.log('📤 [FRONTEND] Invocando edge function move-ticket...');
      console.log('📤 [FRONTEND] Status change detected to concluido:', toStatus === 'concluido');
      
      const { data, error } = await supabase.functions.invoke('move-ticket', {
        body: { ticketId, toStatus, beforeId, afterId },
      });

      console.log('📬 [FRONTEND] Resposta da edge function:', { data, error });

      if (error) {
        console.error('❌ Edge function error moving ticket:', error);
        toast({
          title: "❌ Erro",
          description: `Erro ao mover o ticket: ${error.message || 'Erro desconhecido'}`,
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Ticket moved successfully via edge function:', data);
      
      // Force immediate refetch to ensure UI consistency
      console.log('🔄 Force refetching tickets after move');
      await fetchTickets(true);
      
      toast({
        title: "✅ Sucesso",
        description: "Ticket movido com sucesso",
      });
      
      return true;
    } catch (error) {
      console.error('💥 Error moving ticket:', error);
      console.error('💥 Error details:', error instanceof Error ? error.message : String(error));
      toast({
        title: "❌ Erro",
        description: `Erro inesperado ao mover ticket: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    tickets,
    loading,
    ticketStats,
    lastUpdate, // Timestamp para forçar re-renders
    refetch: () => fetchTickets(true),
    createTicket,
    updateTicket,
    deleteTicket,
    moveTicket,
  };
};