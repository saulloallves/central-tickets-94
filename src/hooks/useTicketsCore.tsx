import { useState, useEffect, useCallback } from 'react';
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
  prioridade: 'baixo' | 'medio' | 'alto' | 'imediato' | 'crise';
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
  // Relations
  unidades?: { id: string; grupo: string; cidade?: string; uf?: string };
  colaboradores?: { nome_completo: string };
  equipes?: { id: string; nome: string };
  atendimento_iniciado_por_profile?: { nome_completo: string };
  created_by_profile?: { nome_completo: string };
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  usuario_id?: string;
  mensagem: string;
  direcao: 'entrada' | 'saida' | 'interna';
  anexos: any[];
  canal: 'web' | 'whatsapp' | 'typebot' | 'interno';
  created_at: string;
  updated_at: string;
  // Relations
  profiles?: { nome_completo: string };
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

export const useTicketsCore = (filters: TicketFilters) => {
  const { user } = useAuth();
  const { isAdmin, isSupervisor, loading: roleLoading } = useRole();
  const { userEquipes, getPrimaryEquipe } = useUserEquipes();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Core CRUD operations
  const fetchTickets = useCallback(async () => {
    if (!user || roleLoading) {
      return;
    }

    try {
      setLoading(true);

      let query = supabase
        .from('tickets')
        .select(`
          *,
          unidades (id, grupo, cidade, uf),
          colaboradores (nome_completo),
          equipes (id, nome),
          atendimento_iniciado_por_profile:profiles!tickets_atendimento_iniciado_por_fkey (nome_completo),
          created_by_profile:profiles!tickets_criado_por_fkey (nome_completo)
        `)
        .order('data_abertura', { ascending: false });

      // Apply filters based on user role
      if (!isAdmin && isSupervisor && userEquipes.length > 0) {
        query = query.in('equipe_responsavel_id', userEquipes.map(e => e.id));
      }

      // Apply search filters
      if (filters.search) {
        query = query.or(`codigo_ticket.ilike.%${filters.search}%,descricao_problema.ilike.%${filters.search}%`);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status as any);
      }

      if (filters.categoria && filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria as any);
      }

      if (filters.prioridade && filters.prioridade !== 'all') {
        query = query.eq('prioridade', filters.prioridade as any);
      }

      if (filters.unidade_id && filters.unidade_id !== 'all') {
        query = query.eq('unidade_id', filters.unidade_id);
      }

      if (filters.status_sla && filters.status_sla !== 'all') {
        query = query.eq('status_sla', filters.status_sla as any);
      }

      if (filters.equipe_id && filters.equipe_id !== 'all') {
        query = query.eq('equipe_responsavel_id', filters.equipe_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        throw error;
      }

      // Filter out crisis tickets that are linked to a crisis
      const filteredTickets = (data || []).filter(ticket => 
        ticket.prioridade !== 'crise' || !ticket.id
      );

      setTickets(filteredTickets as any);
      
      // Calculate stats
      const stats = calculateTicketStats(filteredTickets as any);
      setTicketStats(stats);

    } catch (error) {
      console.error('Error in fetchTickets:', error);
      toast({
        title: "Erro ao carregar tickets",
        description: "Houve um problema ao carregar os tickets. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, roleLoading, isAdmin, isSupervisor, userEquipes, filters, toast]);

  const calculateTicketStats = (ticketsData: Ticket[]): TicketStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysTickets = ticketsData.filter(ticket => {
      const ticketDate = new Date(ticket.data_abertura);
      ticketDate.setHours(0, 0, 0, 0);
      return ticketDate.getTime() === today.getTime();
    });

    const slaVencidoTickets = ticketsData.filter(ticket => ticket.status_sla === 'vencido');
    const emAtendimentoTickets = ticketsData.filter(ticket => ticket.status === 'em_atendimento');
    
    // Calculate average resolution time
    const resolvedTickets = ticketsData.filter(ticket => ticket.resolvido_em);
    const totalResolutionTime = resolvedTickets.reduce((acc, ticket) => {
      const opened = new Date(ticket.data_abertura).getTime();
      const resolved = new Date(ticket.resolvido_em!).getTime();
      return acc + (resolved - opened);
    }, 0);

    const avgResolutionHours = resolvedTickets.length > 0 
      ? Math.round((totalResolutionTime / resolvedTickets.length) / (1000 * 60 * 60))
      : 0;

    return {
      total: ticketsData.length,
      novos: todaysTickets.length,
      sla_vencido: slaVencidoTickets.length,
      em_atendimento: emAtendimentoTickets.length,
      tempo_medio: avgResolutionHours,
    };
  };

  // Optimistic update functions
  const optimisticUpdateTicket = (ticketId: string, updates: Partial<Ticket>) => {
    setTickets(prev => prev.map(ticket => 
      ticket.id === ticketId ? { ...ticket, ...updates } : ticket
    ));
  };

  const optimisticRollback = (ticketId: string, originalStatus: string) => {
    setTickets(prev => prev.map(ticket => 
      ticket.id === ticketId ? { ...ticket, status: originalStatus as any } : ticket
    ));
  };

  // Load tickets on mount and filter changes
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    ticketStats,
    loading,
    fetchTickets,
    optimisticUpdateTicket,
    optimisticRollback,
    calculateTicketStats
  };
};