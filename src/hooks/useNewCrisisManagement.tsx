import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Crisis {
  id: string;
  titulo: string;
  descricao?: string;
  status: 'aberto' | 'investigando' | 'comunicado' | 'mitigado' | 'resolvido' | 'encerrado' | 'reaberto';
  palavras_chave?: string[];
  canal_oficial?: string;
  created_at: string;
  updated_at: string;
  abriu_por?: string;
  ultima_atualizacao: string;
  crise_ticket_links?: Array<{
    ticket_id: string;
    tickets?: {
      codigo_ticket: string;
      titulo?: string;
      descricao_problema?: string;
      unidade_id: string;
      prioridade: string;
      status: string;
      unidades?: {
        grupo: string;
      };
    };
  }>;
  crise_updates?: Array<{
    id: string;
    tipo: string;
    status?: string;
    mensagem: string;
    created_at: string;
    created_by?: string;
  }>;
}

export const useNewCrisisManagement = () => {
  const [activeCrises, setActiveCrises] = useState<Crisis[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchActiveCrises = async () => {
    setLoading(true);
    try {
      // Buscar apenas da tabela crises moderna
      const { data: crisesData, error: crisesError } = await supabase
        .from('crises')
        .select(`
          *,
          crise_ticket_links (
            ticket_id,
            tickets:ticket_id (
              codigo_ticket,
              titulo,
              descricao_problema,
              unidade_id,
              prioridade,
              status,
              unidades:unidade_id (
                grupo
              )
            )
          ),
          crise_updates (
            id,
            tipo,
            status,
            mensagem,
            created_at,
            created_by
          )
        `)
        .neq('status', 'encerrado')
        .order('created_at', { ascending: false });

      if (crisesError) {
        console.error('Error fetching crises:', crisesError);
        return;
      }

      // Expandir tickets de crise se necessário
      const expandedCrises = await Promise.all((crisesData || []).map(async (crisis) => {
        // Se não tem tickets vinculados, buscar tickets similares automaticamente
        if (!crisis.crise_ticket_links?.length && crisis.palavras_chave?.length) {
          const { data: similarTickets } = await supabase
            .from('tickets')
            .select(`
              id,
              codigo_ticket,
              titulo,
              descricao_problema,
              unidade_id,
              prioridade,
              status,
              unidades:unidade_id (
                grupo
              )
            `)
            .eq('prioridade', 'crise')
            .in('status', ['aberto', 'em_atendimento', 'escalonado'])
            .gte('data_abertura', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString());

          // Filtrar tickets que contêm palavras-chave da crise
          const matchingTickets = (similarTickets || []).filter(ticket => 
            ticket.descricao_problema && 
            crisis.palavras_chave?.some(keyword => 
              ticket.descricao_problema.toLowerCase().includes(keyword.toLowerCase())
            )
          );

          if (matchingTickets.length > 0) {
            // Retornar com os tickets vinculados (serão automaticamente vinculados via trigger)
            return {
              ...crisis,
              crise_ticket_links: matchingTickets.map(ticket => ({
                ticket_id: ticket.id,
                tickets: ticket
              }))
            };
          }
        }

        return crisis;
      }));

      setActiveCrises(expandedCrises);
      console.log('🚨 Active crises loaded:', expandedCrises.length);
    } catch (error) {
      console.error('Error fetching active crises:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar crises",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createCrisis = async (
    titulo: string,
    descricao?: string,
    palavrasChave?: string[],
    ticketIds?: string[],
    canalOficial?: string
  ) => {
    try {
      const { data, error } = await supabase.rpc('create_crise', {
        p_titulo: titulo,
        p_descricao: descricao,
        p_palavras_chave: palavrasChave,
        p_ticket_ids: ticketIds,
        p_canal_oficial: canalOficial
      });

      if (error) {
        console.error('Error creating crisis:', error);
        toast({
          title: "Erro",
          description: "Não foi possível criar a crise",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "Sucesso",
        description: "Crise criada com sucesso",
      });

      // Refetch para atualizar a lista
      await fetchActiveCrises();
      return data;
    } catch (error) {
      console.error('Error creating crisis:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao criar crise",
        variant: "destructive",
      });
      return null;
    }
  };

  const addTicketsToCrisis = async (crisisId: string, ticketIds: string[]) => {
    try {
      const { error } = await supabase.rpc('add_tickets_to_crise', {
        p_crise_id: crisisId,
        p_ticket_ids: ticketIds
      });

      if (error) {
        console.error('Error adding tickets to crisis:', error);
        toast({
          title: "Erro",
          description: "Não foi possível adicionar tickets à crise",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Sucesso",
        description: "Tickets adicionados à crise",
      });

      await fetchActiveCrises();
      return true;
    } catch (error) {
      console.error('Error adding tickets to crisis:', error);
      return false;
    }
  };

  const updateCrisisStatus = async (
    crisisId: string,
    status: Crisis['status'],
    mensagem?: string
  ) => {
    try {
      const { error } = await supabase.rpc('update_crise_status', {
        p_crise_id: crisisId,
        p_status: status,
        p_mensagem: mensagem
      });

      if (error) {
        console.error('Error updating crisis status:', error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar status da crise",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Sucesso",
        description: "Status da crise atualizado",
      });

      await fetchActiveCrises();
      return true;
    } catch (error) {
      console.error('Error updating crisis status:', error);
      return false;
    }
  };

  const broadcastMessage = async (crisisId: string, mensagem: string) => {
    try {
      const { error } = await supabase.rpc('broadcast_crise_message', {
        p_crise_id: crisisId,
        p_mensagem: mensagem
      });

      if (error) {
        console.error('Error broadcasting crisis message:', error);
        toast({
          title: "Erro",
          description: "Não foi possível enviar mensagem",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Sucesso",
        description: "Mensagem enviada para todos os tickets",
      });

      await fetchActiveCrises();
      return true;
    } catch (error) {
      console.error('Error broadcasting crisis message:', error);
      return false;
    }
  };

  const resolveCrisisAndCloseTickets = async (
    crisisId: string,
    mensagem?: string,
    statusTicket: 'concluido' | 'em_atendimento' = 'concluido'
  ) => {
    try {
      const { error } = await supabase.rpc('resolve_crise_close_tickets', {
        p_crise_id: crisisId,
        p_mensagem: mensagem,
        p_status_ticket: statusTicket
      });

      if (error) {
        console.error('Error resolving crisis:', error);
        toast({
          title: "Erro",
          description: "Não foi possível resolver a crise",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Sucesso",
        description: "Crise resolvida e tickets atualizados",
      });

      await fetchActiveCrises();
      return true;
    } catch (error) {
      console.error('Error resolving crisis:', error);
      return false;
    }
  };

  // Setup realtime subscriptions and auto-refresh
  useEffect(() => {
    fetchActiveCrises();

    // Subscribe to changes in crises
    const crisesSubscription = supabase
      .channel('crises-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'crises' }, 
        () => {
          console.log('🔄 Crises table changed, refetching...');
          fetchActiveCrises();
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'crise_ticket_links' }, 
        () => {
          console.log('🔄 Crisis ticket links changed, refetching...');
          fetchActiveCrises();
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'crise_updates' }, 
        () => {
          console.log('🔄 Crisis updates changed, refetching...');
          fetchActiveCrises();
        }
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tickets' }, 
        (payload) => {
          if (payload.new && (payload.new as any).prioridade === 'crise') {
            console.log('🔄 Crisis ticket detected, refetching...');
            fetchActiveCrises();
          }
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing crisis data...');
      fetchActiveCrises();
    }, 30000);

    return () => {
      supabase.removeChannel(crisesSubscription);
      clearInterval(interval);
    };
  }, []);

  const refetch = () => {
    fetchActiveCrises();
  };

  return {
    activeCrises,
    loading,
    createCrisis,
    addTicketsToCrisis,
    updateCrisisStatus,
    broadcastMessage,
    resolveCrisisAndCloseTickets,
    refetch
  };
};