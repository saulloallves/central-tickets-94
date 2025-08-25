import { useState, useEffect } from 'react';
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

export const useTickets = (filters: TicketFilters) => {
  const { user } = useAuth();
  const { isAdmin, isGerente, loading: roleLoading } = useRole();
  const { userEquipes, getPrimaryEquipe } = useUserEquipes();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);

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

  const fetchTickets = async () => {
    if (!user || roleLoading) return;
    
    try {
      setLoading(true);
      
      let query = supabase
        .from('tickets')
        .select(`
          *,
          unidades:unidade_id (
            id,
            grupo,
            cidade,
            uf
          ),
          equipes:equipe_responsavel_id (
            id,
            nome
          ),
          atendimento_iniciado_por_profile:atendimento_iniciado_por (
            nome_completo
          ),
          colaboradores (
            nome_completo
          ),
          created_by_profile:criado_por (
            nome_completo
          )
        `)
        .order('status', { ascending: true })
        .order('position', { ascending: true });

      // Apply search filter - now includes titulo
      if (filters.search) {
        query = query.or(`codigo_ticket.ilike.%${filters.search}%,descricao_problema.ilike.%${filters.search}%,titulo.ilike.%${filters.search}%`);
      }

      // Apply status filters
      if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status as any);
      if (filters.categoria && filters.categoria !== 'all') query = query.eq('categoria', filters.categoria as any);
      if (filters.prioridade && filters.prioridade !== 'all') query = query.eq('prioridade', filters.prioridade as any);
      if (filters.status_sla && filters.status_sla !== 'all') query = query.eq('status_sla', filters.status_sla as any);
      if (filters.unidade_id && filters.unidade_id !== 'all') query = query.eq('unidade_id', filters.unidade_id);
      
      // New filter for equipe_id
      if (filters.equipe_id && filters.equipe_id !== 'all') {
        if (filters.equipe_id === 'minhas_equipes') {
          // Filter for user's teams
          const userEquipeIds = userEquipes.map(ue => ue.equipe_id);
          if (userEquipeIds.length > 0) {
            query = query.in('equipe_responsavel_id', userEquipeIds);
          } else {
            // If user has no teams, return no results
            query = query.eq('equipe_responsavel_id', 'none');
          }
        } else {
          query = query.eq('equipe_responsavel_id', filters.equipe_id);
        }
      }

      let { data, error } = await query;

      // Handle RLS recursion errors with fallback
      if (error && error.code === '42P17') {
        console.warn('RLS recursion detected, falling back to simple query:', error.message);
        
        // Fallback query without relations to avoid RLS recursion
        const fallbackQuery = supabase
          .from('tickets')
          .select('*')
          .order('status', { ascending: true })
          .order('position', { ascending: true });

        // Apply same filters
        let fallbackQueryWithFilters = fallbackQuery;
        if (filters.search) {
          fallbackQueryWithFilters = fallbackQueryWithFilters.or(`codigo_ticket.ilike.%${filters.search}%,descricao_problema.ilike.%${filters.search}%,titulo.ilike.%${filters.search}%`);
        }
        if (filters.status && filters.status !== 'all') fallbackQueryWithFilters = fallbackQueryWithFilters.eq('status', filters.status as any);
        if (filters.categoria && filters.categoria !== 'all') fallbackQueryWithFilters = fallbackQueryWithFilters.eq('categoria', filters.categoria as any);
        if (filters.prioridade && filters.prioridade !== 'all') fallbackQueryWithFilters = fallbackQueryWithFilters.eq('prioridade', filters.prioridade as any);
        if (filters.status_sla && filters.status_sla !== 'all') fallbackQueryWithFilters = fallbackQueryWithFilters.eq('status_sla', filters.status_sla as any);
        if (filters.unidade_id && filters.unidade_id !== 'all') fallbackQueryWithFilters = fallbackQueryWithFilters.eq('unidade_id', filters.unidade_id);
        if (filters.equipe_id && filters.equipe_id !== 'all') {
          if (filters.equipe_id === 'minhas_equipes') {
            const userEquipeIds = userEquipes.map(ue => ue.equipe_id);
            if (userEquipeIds.length > 0) {
              fallbackQueryWithFilters = fallbackQueryWithFilters.in('equipe_responsavel_id', userEquipeIds);
            } else {
              fallbackQueryWithFilters = fallbackQueryWithFilters.eq('equipe_responsavel_id', 'none');
            }
          } else {
            fallbackQueryWithFilters = fallbackQueryWithFilters.eq('equipe_responsavel_id', filters.equipe_id);
          }
        }

        const fallbackResult = await fallbackQueryWithFilters;
        const fallbackData = fallbackResult.data;
        error = fallbackResult.error;
        
        if (!error && fallbackData) {
          console.log('✅ Fallback query successful, tickets loaded without relations');
          // Transform data to match expected interface (add missing optional relations)
          data = fallbackData.map(ticket => ({
            ...ticket,
            unidades: undefined,
            colaboradores: undefined,
            equipes: undefined,
            atendimento_iniciado_por_profile: undefined,
            created_by_profile: undefined
          })) as any;
        }
      }

      if (error) {
        console.error('Error fetching tickets:', error);
        // Only show toast for non-recursion errors to avoid spam
        if (error.code !== '42P17' && !loading) {
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

  const calculateStatsFromTickets = (ticketsList: Ticket[]) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Filtrar apenas tickets de hoje para as métricas
    const todaysTickets = ticketsList.filter(t => {
      const ticketDate = new Date(t.data_abertura).toISOString().split('T')[0];
      return ticketDate === today;
    });
    
    const stats: TicketStats = {
      total: todaysTickets.length,
      novos: todaysTickets.length, // Todos os tickets de hoje são "novos" para esta métrica
      sla_vencido: todaysTickets.filter(t => t.status_sla === 'vencido').length,
      em_atendimento: todaysTickets.filter(t => t.status === 'em_atendimento').length,
      tempo_medio: 0
    };

    // Calculate average resolution time apenas para tickets de hoje
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

    console.log('📊 Stats calculated from TODAY tickets only:', stats);
    console.log('📅 Today date filter:', today);
    console.log('🎫 Today tickets found:', todaysTickets.length);
    setTicketStats(stats);
  };

  const fetchTicketStats = async () => {
    // Stats are now calculated from the filtered tickets list
    // This ensures metrics reflect only what the user can see
    calculateStatsFromTickets(tickets);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTickets();
      fetchTicketStats();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [user?.id, roleLoading]);

  // Daily metrics refresh - updates stats every 30 minutes and on day change
  useEffect(() => {
    if (!user || roleLoading) return;

    // Update stats immediately
    fetchTicketStats();

    // Set up interval to refresh stats every 30 minutes
    const statsInterval = setInterval(() => {
      console.log('🕐 Refreshing ticket stats automatically');
      fetchTicketStats();
    }, 30 * 60 * 1000); // 30 minutes

    // Check for day change every minute
    let lastDate = new Date().toDateString();
    const dayChangeInterval = setInterval(() => {
      const currentDate = new Date().toDateString();
      if (currentDate !== lastDate) {
        console.log('📅 Day changed, refreshing tickets and stats');
        lastDate = currentDate;
        fetchTickets();
        fetchTicketStats();
      }
    }, 60 * 1000); // Check every minute

    return () => {
      clearInterval(statsInterval);
      clearInterval(dayChangeInterval);
    };
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

  // Recalculate stats whenever tickets change (including filters)
  useEffect(() => {
    if (tickets.length >= 0) {
      calculateStatsFromTickets(tickets);
    }
  }, [tickets]);

  // Enhanced realtime subscription with handlers
  const handleTicketUpdate = (ticket: Ticket) => {
    console.log('🔄 Realtime ticket update received:', ticket.codigo_ticket);
    setTickets(prev => 
      prev.map(existingTicket => 
        existingTicket.id === ticket.id 
          ? { ...existingTicket, ...ticket } as Ticket
          : existingTicket
      )
    );
    fetchTicketStats();
  };

  const handleTicketInsert = (ticket: Ticket) => {
    console.log('➕ Realtime ticket insert received:', ticket.codigo_ticket);
    setTickets(prev => {
      const exists = prev.find(t => t.id === ticket.id);
      if (exists) return prev;
      return [ticket, ...prev];
    });
    fetchTicketStats();
  };

  const handleTicketDelete = (ticketId: string) => {
    console.log('🗑️ Realtime ticket delete received:', ticketId);
    setTickets(prev => prev.filter(ticket => ticket.id !== ticketId));
    fetchTicketStats();
  };

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
      console.log('🎫 === TICKET CREATION DEBUG ===');
      console.log('📥 Raw ticketData received:', JSON.stringify(ticketData, null, 2));
      console.log('🔍 Priority value detailed analysis:');
      console.log('  - Value:', ticketData.prioridade);
      console.log('  - Type:', typeof ticketData.prioridade);
      console.log('  - JSON stringified:', JSON.stringify(ticketData.prioridade));
      console.log('  - Contains legacy value check: validating priority value');
      console.log('================================');

      // Get user profile to establish relationships
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      let colaborador_id = null;

      if (profile?.email) {
        // Check if user is a colaborador
        const { data: colaborador } = await supabase
          .from('colaboradores')
          .select('id')
          .eq('email', profile.email)
          .single();
        
        if (colaborador) {
          colaborador_id = colaborador.id;
        }
      }

      // Validate priority before inserting - AGGRESSIVE CLEANUP
      const validPriorities = ['imediato', 'ate_1_hora', 'ainda_hoje', 'posso_esperar', 'crise'];
      let finalPriority = ticketData.prioridade || 'posso_esperar';
      
      console.log('🔧 PRIORITY VALIDATION:');
      console.log('  - Original priority:', finalPriority);
      console.log('  - Is valid?', validPriorities.includes(finalPriority));
      
      // FORCE CLEANUP - if ANY invalid priority, use default
      if (!validPriorities.includes(finalPriority)) {
        console.warn(`❌ INVALID PRIORITY DETECTED: "${finalPriority}" - FORCING to "posso_esperar"`);
        finalPriority = 'posso_esperar';
      }
      
      // Extra safety check - convert invalid priority
      if (typeof finalPriority === 'string' && finalPriority.includes('urgente')) {
        console.error('🚨 URGENTE-LIKE VALUE DETECTED - FORCING TO IMEDIATO');
        finalPriority = 'imediato';
      }

      const ticketInsertData = {
        unidade_id: ticketData.unidade_id!,
        descricao_problema: ticketData.descricao_problema!,
        equipe_responsavel_id: ticketData.equipe_responsavel_id || null,
        prioridade: finalPriority,
        subcategoria: ticketData.subcategoria || null,
        colaborador_id,
        criado_por: user.id,
        canal_origem: 'web' as const
      };

      console.log('Final ticket insert data:', ticketInsertData);

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
      }
      
      toast({
        title: "Sucesso",
        description: `Ticket ${data.codigo_ticket} criado com sucesso`,
      });

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

  // Status transition validation (client-side check for better UX)
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    'aberto': ['em_atendimento', 'escalonado', 'concluido'],
    'em_atendimento': ['escalonado', 'concluido', 'aberto'],
    'escalonado': ['em_atendimento', 'concluido', 'aberto'],
    'concluido': ['aberto']
  };

  const isTransitionAllowed = (from: string, to: string): boolean => {
    return ALLOWED_TRANSITIONS[from]?.includes(to) || false;
  };

  // Enhanced drag-and-drop with edge function and position support
  const changeTicketStatus = async (
    ticketId: string, 
    fromStatus: string, 
    toStatus: string,
    beforeId?: string,
    afterId?: string
  ) => {
    // Client-side validation for immediate feedback
    if (!isTransitionAllowed(fromStatus, toStatus)) {
      toast({
        title: "Transição não permitida",
        description: `Não é possível mover de ${fromStatus} para ${toStatus}`,
        variant: "destructive",
      });
      return false;
    }

    // Optimistic update for immediate UI response
    optimisticUpdateTicket(ticketId, { status: toStatus as any });

    try {
      console.log('🚀 Calling move-ticket edge function:', {
        ticketId, 
        fromStatus,
        toStatus,
        beforeId,
        afterId
      });

      const { data, error } = await supabase.functions.invoke('move-ticket', {
        body: {
          ticketId,
          toStatus,
          beforeId: beforeId || null,
          afterId: afterId || null
        }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        
        // Fallback: try direct update without edge function
        console.log('🔄 Attempting fallback direct update...');
        
        try {
          // Calculate position using RPC
          const { data: newPosition, error: positionError } = await supabase
            .rpc('calculate_new_position', {
              p_status: toStatus,
              p_before_id: beforeId || null,
              p_after_id: afterId || null
            });

          if (positionError) {
            throw new Error(`Position calculation failed: ${positionError.message}`);
          }

          // Direct update
          const fallbackPayload: any = {
            position: newPosition,
            updated_at: new Date().toISOString(),
          };

          if (toStatus !== fromStatus) {
            fallbackPayload.status = toStatus;
          }

          const { data: fallbackResult, error: fallbackError } = await supabase
            .from('tickets')
            .update(fallbackPayload)
            .eq('id', ticketId)
            .select('id, status, position')
            .single();

          if (fallbackError) {
            throw new Error(`Direct update failed: ${fallbackError.message}`);
          }

          console.log('✅ Fallback update successful:', fallbackResult);
          
          // Refresh tickets to ensure consistency
          fetchTickets();
          fetchTicketStats();
          
          toast({
            title: "Sucesso",
            description: toStatus !== fromStatus ? `Ticket movido para ${toStatus}` : 'Ordem atualizada',
          });
          
          return true;
          
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          // Rollback optimistic update
          optimisticRollback(ticketId, fromStatus);
          
          toast({
            title: "Erro ao mover ticket",
            description: "Falha na operação principal e backup",
            variant: "destructive",
          });
          return false;
        }
      }

      if (!data?.success) {
        console.error('❌ Move failed:', data);
        // Rollback optimistic update
        optimisticRollback(ticketId, fromStatus);
        
        toast({
          title: "Erro ao mover ticket", 
          description: data?.error || "Falha na operação",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Ticket moved successfully:', data.ticket);
      
      // Refresh tickets to ensure consistency
      fetchTickets();
      fetchTicketStats();
      
      toast({
        title: "Sucesso",
        description: data.message || "Ticket movido com sucesso",
      });
      
      return true;
    } catch (error) {
      console.error('💥 Unexpected error moving ticket:', error);
      // Rollback optimistic update
      optimisticRollback(ticketId, fromStatus);
      
      toast({
        title: "Erro inesperado",
        description: "Falha ao mover ticket",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    try {
      console.log('=== UPDATE TICKET DEBUG ===');
      console.log('Original updates object:', updates);
      console.log('Ticket ID:', ticketId);
      
      // Filter out undefined, null, and empty string values
      // Also ensure enum fields are not included if they're empty
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) => {
          console.log(`Checking field ${key}:`, value, typeof value);
          
          // Filter out undefined, null, and empty string values
          if (value === undefined || value === null || value === '') {
            console.log(`Filtering out ${key} because value is empty`);
            return false;
          }
          
          // Special handling for enum fields - only include if they have valid values
          if (key === 'prioridade') {
            const validPrioridades = ['imediato', 'ate_1_hora', 'ainda_hoje', 'posso_esperar', 'crise'];
            const isValid = validPrioridades.includes(value as string);
            console.log(`Prioridade validation for "${value}":`, isValid);
            return isValid;
          }
          
          if (key === 'status') {
            const validStatus = ['aberto', 'em_atendimento', 'escalonado', 'concluido'];
            const isValid = validStatus.includes(value as string);
            console.log(`Status validation for "${value}":`, isValid);
            return isValid;
          }
          
          if (key === 'categoria') {
            const validCategorias = ['juridico', 'sistema', 'midia', 'operacoes', 'rh', 'financeiro', 'outro'];
            const isValid = validCategorias.includes(value as string);
            console.log(`Categoria validation for "${value}":`, isValid);
            return isValid;
          }
          
          if (key === 'status_sla') {
            const validStatusSla = ['dentro_prazo', 'alerta', 'vencido'];
            const isValid = validStatusSla.includes(value as string);
            console.log(`Status SLA validation for "${value}":`, isValid);
            return isValid;
          }
          
          if (key === 'canal_origem') {
            const validCanais = ['typebot', 'whatsapp_zapi', 'web'];
            const isValid = validCanais.includes(value as string);
            console.log(`Canal origem validation for "${value}":`, isValid);
            return isValid;
          }
          
          if (key === 'canal_resposta') {
            const validCanaisResposta = ['web', 'whatsapp', 'typebot', 'interno'];
            const isValid = validCanaisResposta.includes(value as string);
            console.log(`Canal resposta validation for "${value}":`, isValid);
            return isValid;
          }
          
          console.log(`Including field ${key} with value:`, value);
          return true;
        })
      );

      console.log('Clean updates object:', cleanUpdates);
      console.log('===========================');

      const { data, error } = await supabase
        .from('tickets')
        .update(cleanUpdates)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar o ticket",
          variant: "destructive",
        });
        return null;
      }

      // Don't show success toast for drag-and-drop status changes
      if (!cleanUpdates.status) {
        toast({
          title: "Sucesso",
          description: "Ticket atualizado com sucesso",
        });
      }

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

  const startAttendance = async (ticketId: string, selectedEquipeId?: string) => {
    if (!user?.id) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return null;
    }

    try {
      // Determinar qual equipe usar
      let equipeId = selectedEquipeId;
      
      if (!equipeId) {
        // Se não foi especificada, usar a equipe do usuário
        if (userEquipes.length === 0) {
          toast({
            title: "Configuração Pendente",
            description: "Você não está vinculado a nenhuma equipe. Entre em contato com o administrador.",
            variant: "destructive",
          });
          return null;
        }
        
        if (userEquipes.length === 1) {
          // Uma equipe: usar diretamente
          equipeId = userEquipes[0].equipes.id;
        } else {
          // Múltiplas equipes: usar a primária ou retornar erro para seleção manual
          const primaryEquipe = getPrimaryEquipe();
          if (primaryEquipe) {
            equipeId = primaryEquipe.equipes.id;
          } else {
            toast({
              title: "Seleção Necessária",
              description: "Você pertence a múltiplas equipes. Selecione uma equipe para iniciar o atendimento.",
              variant: "destructive",
            });
            return null;
          }
        }
      }

      const updates = {
        status: 'em_atendimento' as const,
        equipe_responsavel_id: equipeId,
        atendimento_iniciado_por: user.id,
        atendimento_iniciado_em: new Date().toISOString()
      };

      const result = await updateTicket(ticketId, updates);
      
      if (result) {
        const equipeNome = userEquipes.find(eq => eq.equipes.id === equipeId)?.equipes.nome || 'Equipe';
        toast({
          title: "Sucesso",
          description: `Atendimento iniciado pela equipe ${equipeNome}`,
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error starting attendance:', error);
      toast({
        title: "Erro",
        description: "Erro ao iniciar atendimento",
        variant: "destructive",
      });
      return null;
    }
  };

  const concludeTicket = async (ticketId: string) => {
    try {
      const updates = {
        status: 'concluido' as const,
        resolvido_em: new Date().toISOString()
      };

      const result = await updateTicket(ticketId, updates);
      
      if (result) {
        toast({
          title: "Sucesso",
          description: "Ticket concluído com sucesso",
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error concluding ticket:', error);
      toast({
        title: "Erro",
        description: "Erro ao concluir ticket",
        variant: "destructive",
      });
      return null;
    }
  };

  const refetchData = () => {
    fetchTickets();
    fetchTicketStats();
  };

  return {
    tickets,
    ticketStats,
    loading,
    createTicket,
    updateTicket,
    startAttendance,
    concludeTicket,
    refetch: refetchData,
    // Optimistic UI functions
    optimisticUpdateTicket,
    optimisticRollback,
    // Enhanced Drag and Drop function with position support
    changeTicketStatus,
    // Realtime handlers
    handleTicketUpdate,
    handleTicketInsert,
    handleTicketDelete
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

      // Adicionar mensagem otimisticamente na interface
      const { data: user } = await supabase.auth.getUser();
      const newMessage: TicketMessage = {
        id: data.id,
        ticket_id: data.ticket_id,
        usuario_id: data.usuario_id,
        mensagem: data.mensagem,
        direcao: data.direcao,
        anexos: data.anexos ? (Array.isArray(data.anexos) ? data.anexos : []) : [],
        canal: data.canal,
        created_at: data.created_at,
        updated_at: data.updated_at,
        profiles: user.user ? { nome_completo: user.user.user_metadata?.nome_completo || 'Você' } : undefined
      };
      
      setMessages(prev => [...prev, newMessage]);
      
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
      
      return true;
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

  // Realtime subscription for ticket messages
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_mensagens',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          console.log('Realtime message change:', payload);
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  return {
    messages,
    loading,
    sendMessage,
    refetch: fetchMessages
  };
};
