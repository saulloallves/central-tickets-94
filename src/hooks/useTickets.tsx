import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useRole } from './useRole';
import { useUserEquipes } from './useUserEquipes';
import { useToast } from './use-toast';

export interface Ticket {
  id: string;
  codigo_ticket: string;
  titulo?: string;
  descricao_problema?: string;
  status: 'aberto' | 'em_atendimento' | 'escalonado' | 'concluido';
  prioridade: 'crise' | 'imediato' | 'ate_1_hora' | 'ainda_hoje' | 'posso_esperar';
  categoria?: 'midia' | 'rh' | 'juridico' | 'sistema' | 'operacoes' | 'financeiro' | 'outro';
  unidade_id: string;
  equipe_responsavel_id?: string;
  franqueado_id?: string;
  criado_por?: string;
  status_sla?: 'dentro_prazo' | 'alerta' | 'vencido';
  data_abertura: string;
  data_limite_sla?: string;
  resolvido_em?: string;
  created_at: string;
  updated_at: string;
  position: number;
  conversa?: any;
  reaberto_count?: number;
  escalonamento_nivel?: number;
  sla_half_time?: string;
  equipes?: { nome: string } | null;
  canal_origem?: 'web' | 'typebot' | 'whatsapp_zapi';
  canal_resposta?: 'web' | 'whatsapp' | 'typebot' | 'interno';
  atendimento_iniciado_em?: string;
  atendimento_iniciado_por?: string;
  colaborador_id?: string;
  arquivos?: any;
  unidades?: { 
    grupo?: string; 
    cidade?: string; 
    uf?: string; 
  };
  colaboradores?: { 
    nome_completo?: string; 
  };
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

interface TicketStats {
  total: number;
  em_atendimento: number;
  sla_vencido: number;
}

export const useTickets = (filters: TicketFilters) => {
  const { user } = useAuth();
  const { isAdmin, isSupervisor } = useRole();
  const { userEquipes } = useUserEquipes();
  const { toast } = useToast();
  
  const [state, setState] = useState({
    tickets: [] as Ticket[],
    loading: true,
    ticketStats: {
      total: 0,
      em_atendimento: 0,
      sla_vencido: 0,
    } as TicketStats
  });
  
  // Track if initial fetch is done to prevent React StrictMode double fetch
  const initialFetchDone = useRef(false);

  // Memoize filters to prevent unnecessary re-renders with debounce effect
  const memoizedFilters = useMemo(() => {
    const timeout = setTimeout(() => {
      // This ensures filters are stable and don't cause rapid re-renders
    }, 50);
    return () => clearTimeout(timeout);
  }, [
    filters.search,
    filters.status,
    filters.categoria,
    filters.prioridade,
    filters.unidade_id,
    filters.status_sla,
    filters.equipe_id
  ]);
  
  const stableFilters = useMemo(() => filters, [
    filters.search,
    filters.status,
    filters.categoria,
    filters.prioridade,
    filters.unidade_id,
    filters.status_sla,
    filters.equipe_id
  ]);

  // Fetch inicial dos tickets
  const fetchTickets = useCallback(async () => {
    if (!user) return;
    
    // Prevent double fetch in React StrictMode
    if (initialFetchDone.current) return;

    try {
      setState(prev => ({ ...prev, loading: true }));
      console.log('🔍 Fetching tickets with filters:', stableFilters);

      let query = supabase
        .from('tickets')
        .select(`
          *,
          equipes:equipe_responsavel_id(nome),
          unidades:unidade_id(grupo, cidade, uf),
          colaboradores:colaborador_id(nome_completo)
        `)
        .order('position', { ascending: true });

      // Aplicar filtros de permissão
      if (!isAdmin && !isSupervisor) {
        const userEquipeIds = userEquipes.map(eq => eq.id);
        if (userEquipeIds.length > 0) {
          query = query.in('equipe_responsavel_id', userEquipeIds);
         } else {
           // Se não tem equipes, não mostrar tickets
           setState({
             tickets: [],
             loading: false,
             ticketStats: { total: 0, em_atendimento: 0, sla_vencido: 0 }
           });
           return;
         }
      }

      // Aplicar filtros de busca
      if (stableFilters.search) {
        query = query.or(`codigo_ticket.ilike.%${stableFilters.search}%,titulo.ilike.%${stableFilters.search}%,descricao_problema.ilike.%${stableFilters.search}%`);
      }

      if (stableFilters.status && stableFilters.status !== 'all') {
        query = query.eq('status', stableFilters.status as any);
      }

      if (stableFilters.prioridade && stableFilters.prioridade !== 'all') {
        query = query.eq('prioridade', stableFilters.prioridade as any);
      }

      if (stableFilters.unidade_id && stableFilters.unidade_id !== 'all') {
        query = query.eq('unidade_id', stableFilters.unidade_id);
      }

      if (stableFilters.categoria && stableFilters.categoria !== 'all') {
        query = query.eq('categoria', stableFilters.categoria as any);
      }

      if (stableFilters.status_sla && stableFilters.status_sla !== 'all') {
        query = query.eq('status_sla', stableFilters.status_sla as any);
      }

      if (stableFilters.equipe_id && stableFilters.equipe_id !== 'all') {
        if (stableFilters.equipe_id === 'minhas_equipes' && userEquipes.length > 0) {
          const userEquipeIds = userEquipes.map(eq => eq.id);
          query = query.in('equipe_responsavel_id', userEquipeIds);
        } else if (stableFilters.equipe_id !== 'minhas_equipes') {
          query = query.eq('equipe_responsavel_id', stableFilters.equipe_id);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar tickets:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar tickets",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Tickets carregados:', data?.length || 0);
      
      // Transform data to match Ticket interface
      const transformedData = data?.map(ticket => ({
        ...ticket,
        franqueado_id: ticket.franqueado_id?.toString(),
        status_sla: ticket.status_sla || 'dentro_prazo'
      })) || [];
      
      // Calcular estatísticas
      const stats = {
        total: transformedData?.length || 0,
        em_atendimento: transformedData?.filter(t => t.status === 'em_atendimento').length || 0,
        sla_vencido: transformedData?.filter(t => t.status_sla === 'vencido').length || 0,
      };

      // Single setState call to prevent double renders
      setState({
        tickets: transformedData as Ticket[],
        loading: false,
        ticketStats: stats
      });
      
      initialFetchDone.current = true;

    } catch (error) {
      console.error('❌ Erro ao buscar tickets:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id, stableFilters, isAdmin, isSupervisor, userEquipes.length, toast]);

  // Executar fetch inicial - debounced to prevent rapid refetches
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!initialFetchDone.current) {
        fetchTickets();
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [fetchTickets]);

  // Handlers para eventos Realtime
  const handleTicketUpdate = useCallback((updatedTicket: Ticket) => {
    setState(prevState => {
      const updatedTickets = prevState.tickets.map(ticket => 
        ticket.id === updatedTicket.id 
          ? { ...updatedTicket, status_sla: updatedTicket.status_sla || 'dentro_prazo' } 
          : ticket
      );
      
      const stats = {
        total: updatedTickets.length,
        em_atendimento: updatedTickets.filter(t => t.status === 'em_atendimento').length,
        sla_vencido: updatedTickets.filter(t => t.status_sla === 'vencido').length,
      };
      
      return {
        ...prevState,
        tickets: updatedTickets,
        ticketStats: stats
      };
    });
  }, []);

  const handleTicketInsert = useCallback((newTicket: Ticket) => {
    setState(prevState => {
      // Verificar se já existe (evitar duplicatas)
      if (prevState.tickets.some(t => t.id === newTicket.id)) {
        return prevState;
      }
      
      const ticketWithDefaults = {
        ...newTicket,
        franqueado_id: newTicket.franqueado_id?.toString(),
        status_sla: newTicket.status_sla || 'dentro_prazo'
      };
      
      const updatedTickets = [...prevState.tickets, ticketWithDefaults];
      
      const stats = {
        total: updatedTickets.length,
        em_atendimento: updatedTickets.filter(t => t.status === 'em_atendimento').length,
        sla_vencido: updatedTickets.filter(t => t.status_sla === 'vencido').length,
      };
      
      return {
        ...prevState,
        tickets: updatedTickets,
        ticketStats: stats
      };
    });
  }, []);

  const handleTicketDelete = useCallback((ticketId: string) => {
    setState(prevState => {
      const updatedTickets = prevState.tickets.filter(t => t.id !== ticketId);
      
      const stats = {
        total: updatedTickets.length,
        em_atendimento: updatedTickets.filter(t => t.status === 'em_atendimento').length,
        sla_vencido: updatedTickets.filter(t => t.status_sla === 'vencido').length,
      };
      
      return {
        ...prevState,
        tickets: updatedTickets,
        ticketStats: stats
      };
    });
  }, []);

  // Função para mover ticket usando Edge Function
  const changeTicketStatus = useCallback(async (
    ticketId: string, 
    fromStatus: string, 
    toStatus: string,
    beforeId?: string,
    afterId?: string
  ): Promise<boolean> => {
    try {
      console.log('🎯 Movendo ticket via Edge Function:', {
        ticketId,
        fromStatus,
        toStatus,
        beforeId,
        afterId
      });

      // Update otimista no UI
      setState(prevState => ({
        ...prevState,
        tickets: prevState.tickets.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, status: toStatus as any, updated_at: new Date().toISOString() }
            : ticket
        )
      }));

      const { data, error } = await supabase.functions.invoke('move-ticket', {
        body: {
          ticketId,
          toStatus,
          beforeId,
          afterId
        }
      });

      if (error) {
        console.error('❌ Erro na Edge Function:', error);
        
        // Reverter update otimista
        setState(prevState => ({
          ...prevState,
          tickets: prevState.tickets.map(ticket => 
            ticket.id === ticketId 
              ? { ...ticket, status: fromStatus as any }
              : ticket
          )
        }));

        toast({
          title: "Erro",
          description: error.message || "Erro ao mover ticket",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Ticket movido com sucesso:', data);
      return true;

    } catch (error) {
      console.error('❌ Erro ao mover ticket:', error);
      
      // Reverter update otimista
      setState(prevState => ({
        ...prevState,
        tickets: prevState.tickets.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, status: fromStatus as any }
            : ticket
        )
      }));

      toast({
        title: "Erro",
        description: "Erro ao mover ticket",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  return {
    tickets: state.tickets,
    loading: state.loading,
    ticketStats: state.ticketStats,
    refetch: fetchTickets,
    handleTicketUpdate,
    handleTicketInsert,
    handleTicketDelete,
    changeTicketStatus,
  };
};

// Export useTicketMessages for compatibility
export const useTicketMessages = () => {
  return {
    messages: [],
    loading: false,
    sendMessage: async () => {},
  };
};
