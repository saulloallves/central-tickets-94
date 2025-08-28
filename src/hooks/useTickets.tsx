
import { useState, useEffect, useCallback } from 'react';
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
  status_sla: 'dentro_prazo' | 'alerta' | 'vencido';
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
  // Additional properties that exist in the database
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
  created_by_profile?: { 
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
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticketStats, setTicketStats] = useState<TicketStats>({
    total: 0,
    em_atendimento: 0,
    sla_vencido: 0,
  });

  // Fetch inicial dos tickets
  const fetchTickets = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('🔍 Fetching tickets with filters:', filters);

      let query = supabase
        .from('tickets')
        .select(`
          *,
          equipes:equipe_responsavel_id(nome),
          unidades:unidade_id(grupo, cidade, uf),
          colaboradores:colaborador_id(nome_completo),
          created_by_profile:profiles!tickets_criado_por_fkey(nome_completo)
        `)
        .order('position', { ascending: true });

      // Aplicar filtros de permissão
      if (!isAdmin && !isSupervisor) {
        const userEquipeIds = userEquipes.map(eq => eq.id);
        if (userEquipeIds.length > 0) {
          query = query.in('equipe_responsavel_id', userEquipeIds);
        } else {
          // Se não tem equipes, não mostrar tickets
          setTickets([]);
          setLoading(false);
          return;
        }
      }

      // Aplicar filtros de busca
      if (filters.search) {
        query = query.or(`codigo_ticket.ilike.%${filters.search}%,titulo.ilike.%${filters.search}%,descricao_problema.ilike.%${filters.search}%`);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.prioridade && filters.prioridade !== 'all') {
        query = query.eq('prioridade', filters.prioridade);
      }

      if (filters.unidade_id && filters.unidade_id !== 'all') {
        query = query.eq('unidade_id', filters.unidade_id);
      }

      if (filters.categoria && filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria);
      }

      if (filters.status_sla && filters.status_sla !== 'all') {
        query = query.eq('status_sla', filters.status_sla);
      }

      if (filters.equipe_id && filters.equipe_id !== 'all') {
        if (filters.equipe_id === 'minhas_equipes' && userEquipes.length > 0) {
          const userEquipeIds = userEquipes.map(eq => eq.id);
          query = query.in('equipe_responsavel_id', userEquipeIds);
        } else if (filters.equipe_id !== 'minhas_equipes') {
          query = query.eq('equipe_responsavel_id', filters.equipe_id);
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
      
      setTickets(transformedData);

      // Calcular estatísticas
      const stats = {
        total: transformedData?.length || 0,
        em_atendimento: transformedData?.filter(t => t.status === 'em_atendimento').length || 0,
        sla_vencido: transformedData?.filter(t => t.status_sla === 'vencido').length || 0,
      };
      setTicketStats(stats);

    } catch (error) {
      console.error('❌ Erro ao buscar tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [user, filters, isAdmin, isSupervisor, userEquipes, toast]);

  // Executar fetch inicial
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Handlers para eventos Realtime
  const handleTicketUpdate = useCallback((updatedTicket: Ticket) => {
    setTickets(prevTickets => 
      prevTickets.map(ticket => 
        ticket.id === updatedTicket.id ? { ...updatedTicket, status_sla: updatedTicket.status_sla || 'dentro_prazo' } : ticket
      )
    );
    
    // Recalcular stats
    setTickets(currentTickets => {
      const stats = {
        total: currentTickets.length,
        em_atendimento: currentTickets.filter(t => t.status === 'em_atendimento').length,
        sla_vencido: currentTickets.filter(t => t.status_sla === 'vencido').length,
      };
      setTicketStats(stats);
      return currentTickets;
    });
  }, []);

  const handleTicketInsert = useCallback((newTicket: Ticket) => {
    setTickets(prevTickets => {
      // Verificar se já existe (evitar duplicatas)
      if (prevTickets.some(t => t.id === newTicket.id)) {
        return prevTickets;
      }
      
      const ticketWithDefaults = {
        ...newTicket,
        franqueado_id: newTicket.franqueado_id?.toString(),
        status_sla: newTicket.status_sla || 'dentro_prazo'
      };
      
      const updatedTickets = [...prevTickets, ticketWithDefaults];
      
      // Recalcular stats
      const stats = {
        total: updatedTickets.length,
        em_atendimento: updatedTickets.filter(t => t.status === 'em_atendimento').length,
        sla_vencido: updatedTickets.filter(t => t.status_sla === 'vencido').length,
      };
      setTicketStats(stats);
      
      return updatedTickets;
    });
  }, []);

  const handleTicketDelete = useCallback((ticketId: string) => {
    setTickets(prevTickets => {
      const updatedTickets = prevTickets.filter(t => t.id !== ticketId);
      
      // Recalcular stats
      const stats = {
        total: updatedTickets.length,
        em_atendimento: updatedTickets.filter(t => t.status === 'em_atendimento').length,
        sla_vencido: updatedTickets.filter(t => t.status_sla === 'vencido').length,
      };
      setTicketStats(stats);
      
      return updatedTickets;
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
      setTickets(prevTickets => 
        prevTickets.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, status: toStatus as any, updated_at: new Date().toISOString() }
            : ticket
        )
      );

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
        setTickets(prevTickets => 
          prevTickets.map(ticket => 
            ticket.id === ticketId 
              ? { ...ticket, status: fromStatus as any }
              : ticket
          )
        );

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
      setTickets(prevTickets => 
        prevTickets.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, status: fromStatus as any }
            : ticket
        )
      );

      toast({
        title: "Erro",
        description: "Erro ao mover ticket",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  // Create ticket function
  const createTicket = useCallback(async (ticketData: any) => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert([ticketData])
        .select()
        .single();

      if (error) throw error;
      
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erro ao criar ticket:', error);
      return { data: null, error };
    }
  }, []);

  return {
    tickets,
    loading,
    ticketStats,
    refetch: fetchTickets,
    handleTicketUpdate,
    handleTicketInsert,
    handleTicketDelete,
    changeTicketStatus,
    createTicket,
  };
};

// Export useTicketMessages for compatibility
export const useTicketMessages = (ticketId?: string) => {
  // Simple implementation for compatibility
  return {
    messages: [],
    loading: false,
    sendMessage: async () => {},
  };
};
