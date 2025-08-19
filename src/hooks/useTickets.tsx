import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useRole } from './useRole';
import { useToast } from '@/hooks/use-toast';

export interface Ticket {
  id: string;
  codigo_ticket: string;
  unidade_id: string;
  franqueado_id?: number;
  colaborador_id?: string;
  descricao_problema: string;
  canal_origem: 'typebot' | 'whatsapp_zapi' | 'web';
  status: 'aberto' | 'em_atendimento' | 'escalonado' | 'concluido';
  categoria?: 'juridico' | 'sistema' | 'midia' | 'operacoes' | 'rh' | 'financeiro' | 'outro';
  subcategoria?: string;
  prioridade: 'urgente' | 'alta' | 'hoje_18h' | 'padrao_24h' | 'crise';
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
  created_at: string;
  updated_at: string;
  // Relations
  unidades?: { grupo: string };
  colaboradores?: { nome_completo: string };
  franqueados?: { name: string };
  equipes?: { id: string; nome: string };
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

export const useTickets = (filters: TicketFilters) => {
  const { user } = useAuth();
  const { isAdmin, isGerente, loading: roleLoading } = useRole();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    if (!user || roleLoading) return;
    
    try {
      setLoading(true);
      
      // Updated query to use the new foreign key relationship
      let query = supabase
        .from('tickets')
        .select(`
          *,
          equipes:equipe_responsavel_id (
            id,
            nome
          )
        `)
        .order('created_at', { ascending: false });

      // Apply search filter
      if (filters.search) {
        query = query.or(`codigo_ticket.ilike.%${filters.search}%,descricao_problema.ilike.%${filters.search}%`);
      }

      // Apply status filters
      if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status as any);
      if (filters.categoria && filters.categoria !== 'all') query = query.eq('categoria', filters.categoria as any);
      if (filters.prioridade && filters.prioridade !== 'all') query = query.eq('prioridade', filters.prioridade as any);
      if (filters.status_sla && filters.status_sla !== 'all') query = query.eq('status_sla', filters.status_sla as any);
      if (filters.unidade_id && filters.unidade_id !== 'all') query = query.eq('unidade_id', filters.unidade_id);
      
      // New filter for equipe_id
      if (filters.equipe_id && filters.equipe_id !== 'all') {
        query = query.eq('equipe_responsavel_id', filters.equipe_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        if (!loading) {
          toast({
            title: "Erro",
            description: "Não foi possível carregar os tickets",
            variant: "destructive",
          });
        }
        return;
      }

      console.log('Tickets fetched successfully:', data?.length || 0);
      setTickets((data as any) || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      if (!loading) {
        toast({
          title: "Erro",
          description: "Erro inesperado ao carregar tickets",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketStats = async () => {
    if (!user || roleLoading) return;

    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('status, status_sla, created_at, resolvido_em, data_abertura');

      if (error) {
        console.error('Error fetching stats:', error);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const stats: TicketStats = {
        total: data.length,
        novos: data.filter(t => t.created_at.startsWith(today)).length,
        sla_vencido: data.filter(t => t.status_sla === 'vencido').length,
        em_atendimento: data.filter(t => t.status === 'em_atendimento').length,
        tempo_medio: 0
      };

      // Calculate average resolution time
      const resolvedTickets = data.filter(t => t.resolvido_em);
      if (resolvedTickets.length > 0) {
        const totalHours = resolvedTickets.reduce((acc, ticket) => {
          const opened = new Date(ticket.data_abertura);
          const resolved = new Date(ticket.resolvido_em);
          const hours = (resolved.getTime() - opened.getTime()) / (1000 * 60 * 60);
          return acc + hours;
        }, 0);
        stats.tempo_medio = totalHours / resolvedTickets.length;
      }

      setTicketStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTickets();
      fetchTicketStats();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [user?.id, roleLoading]);

  // Separate effect for filters to avoid infinite loop - now including equipe_id
  useEffect(() => {
    if (user && !roleLoading) {
      const timeoutId = setTimeout(() => {
        fetchTickets();
      }, 300); // Debounce filter changes
      
      return () => clearTimeout(timeoutId);
    }
  }, [filters.search, filters.status, filters.categoria, filters.prioridade, filters.status_sla, filters.unidade_id, filters.equipe_id]);

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
      console.log('Creating ticket with data:', ticketData);

      // Get user profile to establish relationships
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      let colaborador_id = null;
      let franqueado_id = null;

      if (profile?.email) {
        // Check if user is a colaborador
        const { data: colaborador } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('email', profile.email)
          .single();
        
        if (colaborador) {
          colaborador_id = colaborador.id;
        } else {
          // Check if user is a franqueado
          const { data: franqueado } = await supabase
            .from('franqueados')
            .select('Id')
            .eq('email', profile.email)
            .single();
          
          if (franqueado) {
            franqueado_id = franqueado.Id;
          }
        }
      }

      const ticketInsertData = {
        unidade_id: ticketData.unidade_id!,
        descricao_problema: ticketData.descricao_problema!,
        categoria: ticketData.categoria || null,
        prioridade: ticketData.prioridade || 'padrao_24h',
        subcategoria: ticketData.subcategoria || null,
        colaborador_id,
        franqueado_id,
        criado_por: user.id,
        canal_origem: 'web' as const
      };

      console.log('Inserting ticket data:', ticketInsertData);

      const { data, error } = await supabase
        .from('tickets')
        .insert(ticketInsertData as any)
        .select()
        .single();

      if (error) {
        console.error('Error creating ticket:', error);
        toast({
          title: "Erro",
          description: `Não foi possível criar o ticket: ${error.message}`,
          variant: "destructive",
        });
        return null;
      }

      console.log('Ticket created successfully:', data);
      
      // Disparar análise da IA automaticamente
      try {
        await supabase.functions.invoke('analyze-ticket', {
          body: {
            ticketId: data.id,
            descricao: ticketData.descricao_problema,
            categoria: ticketData.categoria
          }
        });

        // Disparar notificação de novo ticket
        await supabase.functions.invoke('process-notifications', {
          body: {
            ticketId: data.id,
            type: 'ticket_criado'
          }
        });
      } catch (aiError) {
        console.error('Error in AI analysis or notifications:', aiError);
        // Não falhar a criação do ticket por causa da IA
      }
      
      toast({
        title: "Sucesso",
        description: `Ticket ${data.codigo_ticket} criado com sucesso`,
      });

      // Refresh tickets list
      fetchTickets();
      fetchTicketStats();
      return data;
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
      const { data, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error('Error updating ticket:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o ticket",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Sucesso",
        description: "Ticket atualizado com sucesso",
      });

      fetchTickets();
      fetchTicketStats();
      return data;
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

  return {
    tickets,
    ticketStats,
    loading,
    createTicket,
    updateTicket,
    refetch: fetchTickets
  };
};

export const useTicketMessages = (ticketId: string) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!ticketId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ticket_mensagens')
        .select(`
          *,
          profiles:usuario_id (nome_completo)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as mensagens",
          variant: "destructive",
        });
        return;
      }

      setMessages((data as any) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (mensagem: string, anexos: any[] = []) => {
    if (!ticketId || !mensagem.trim()) return;

    try {
      const { data, error } = await supabase
        .from('ticket_mensagens')
        .insert([{
          ticket_id: ticketId,
          usuario_id: (await supabase.auth.getUser()).data.user?.id,
          mensagem,
          anexos,
          direcao: 'saida',
          canal: 'web'
        }])
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        toast({
          title: "Erro",
          description: "Não foi possível enviar a mensagem",
          variant: "destructive",
        });
        return;
      }

      fetchMessages();
      
      // Enviar notificação WhatsApp para o grupo
      try {
        await supabase.functions.invoke('process-notifications', {
          body: {
            ticketId,
            type: 'resposta_ticket',
            textoResposta: mensagem
          }
        });
      } catch (notifyError) {
        console.error('Error sending WhatsApp notification:', notifyError);
        // Não mostrar erro ao usuário pois a mensagem foi enviada com sucesso
      }
      
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao enviar mensagem",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [ticketId]);

  return {
    messages,
    loading,
    sendMessage,
    refetch: fetchMessages
  };
};
