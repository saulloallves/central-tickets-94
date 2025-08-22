
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Crisis {
  id: string;
  titulo: string;
  descricao: string | null;
  status: 'aberto' | 'investigando' | 'comunicado' | 'mitigado' | 'resolvido' | 'encerrado' | 'reaberto';
  palavras_chave: string[] | null;
  canal_oficial: string | null;
  created_at: string;
  updated_at: string;
  abriu_por: string | null;
  ultima_atualizacao: string;
  // Relations
  crise_ticket_links?: Array<{
    ticket_id: string;
    tickets?: {
      codigo_ticket: string;
      titulo: string;
      descricao_problema: string;
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
    status: string | null;
    mensagem: string;
    created_at: string;
    created_by: string | null;
  }>;
}

export const useNewCrisisManagement = () => {
  const [activeCrises, setActiveCrises] = useState<Crisis[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchActiveCrises = async () => {
    try {
      // Buscar da tabela crises_ativas também
      const { data: activeCrisesData, error: activeCrisesError } = await supabase
        .from('crises_ativas')
        .select(`
          id,
          motivo,
          criada_em,
          resolvida_em,
          ticket_id,
          impacto_regional,
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
        `)
        .is('resolvida_em', null)
        .order('criada_em', { ascending: false });

      // Buscar também da tabela crises
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

      if (activeCrisesError) {
        console.error('Error fetching active crises:', activeCrisesError);
      }

      if (crisesError) {
        console.error('Error fetching crises:', crisesError);
      }

      // Converter crises_ativas para formato compatível e buscar TODOS os tickets de crise
      const formattedActiveCrises = await Promise.all((activeCrisesData || []).map(async (crisis) => {
        // Buscar todos os tickets com prioridade crise que têm problema similar
        const { data: allCrisisTickets } = await supabase
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
          .eq('status', 'escalonado')
          .gte('data_abertura', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()); // Últimas 4 horas

        const similarTickets = (allCrisisTickets || []).filter(ticket => 
          ticket.descricao_problema && 
          crisis.tickets?.descricao_problema &&
          ticket.descricao_problema.toLowerCase().includes(
            crisis.tickets.descricao_problema.split(' ')[0].toLowerCase()
          )
        );

        return {
          id: crisis.id,
          titulo: crisis.motivo || 'Crise Ativa',
          descricao: `Crise iniciada em ${new Date(crisis.criada_em).toLocaleString('pt-BR')} - ${similarTickets.length} tickets afetados`,
          status: 'aberto' as const,
          palavras_chave: null,
          canal_oficial: null,
          created_at: crisis.criada_em,
          updated_at: crisis.criada_em,
          abriu_por: null,
          ultima_atualizacao: crisis.criada_em,
          crise_ticket_links: similarTickets.map(ticket => ({
            ticket_id: ticket.id,
            tickets: ticket
          })),
          crise_updates: []
        };
      }));

      // Combinar ambas as fontes
      const allCrises = [...formattedActiveCrises, ...(crisesData || [])];
      setActiveCrises(allCrises);

      console.log('🚨 Active crises loaded:', allCrises.length);
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
        title: "🚨 Crise Criada",
        description: "Nova crise foi criada e tickets foram vinculados",
        variant: "destructive",
      });

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
          description: "Não foi possível vincular tickets à crise",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Tickets Vinculados",
        description: "Tickets foram vinculados à crise com sucesso",
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
        title: "Status Atualizado",
        description: `Crise marcada como ${status}`,
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
        console.error('Error broadcasting message:', error);
        toast({
          title: "Erro",
          description: "Não foi possível enviar mensagem para todos os tickets",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Mensagem Enviada",
        description: "Mensagem foi enviada para todos os tickets da crise",
      });

      await fetchActiveCrises();
      return true;
    } catch (error) {
      console.error('Error broadcasting message:', error);
      return false;
    }
  };

  const resolveCrisisAndCloseTickets = async (
    crisisId: string,
    mensagem?: string,
    statusTicket: 'concluido' | 'em_atendimento' = 'concluido'
  ) => {
    try {
      // Verificar se é uma crise da tabela crises_ativas ou crises
      const { data: activeCrisis } = await supabase
        .from('crises_ativas')
        .select('id, ticket_id')
        .eq('id', crisisId)
        .single();

      if (activeCrisis) {
        // É uma crise ativa - usar função específica para resolver
        const { error } = await supabase.rpc('resolve_crisis', {
          p_crisis_id: crisisId,
          p_resolvida_por: (await supabase.auth.getUser()).data.user?.id
        });

        if (error) {
          console.error('Error resolving active crisis:', error);
          toast({
            title: "Erro",
            description: "Não foi possível encerrar a crise ativa",
            variant: "destructive",
          });
          return false;
        }

        // Atualizar ticket vinculado se necessário
        if (activeCrisis.ticket_id && statusTicket === 'concluido') {
          await supabase
            .from('tickets')
            .update({ status: statusTicket })
            .eq('id', activeCrisis.ticket_id);
        }
      } else {
        // É uma crise da tabela crises - usar função original
        const { error } = await supabase.rpc('resolve_crise_close_tickets', {
          p_crise_id: crisisId,
          p_mensagem: mensagem,
          p_status_ticket: statusTicket
        });

        if (error) {
          console.error('Error resolving crisis:', error);
          toast({
            title: "Erro",
            description: "Não foi possível encerrar a crise",
            variant: "destructive",
          });
          return false;
        }
      }

      toast({
        title: "✅ Crise Encerrada",
        description: "A crise foi encerrada e todos os tickets foram atualizados",
      });

      await fetchActiveCrises();
      return true;
    } catch (error) {
      console.error('Error resolving crisis:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchActiveCrises();

    // Enhanced realtime subscription para crises e tickets
    const channel = supabase
      .channel('crises-enhanced-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crises'
        },
        (payload) => {
          console.log('🚨 Realtime crisis change:', payload);
          // Refetch immediately for any crisis change
          setTimeout(() => fetchActiveCrises(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crises_ativas'
        },
        (payload) => {
          console.log('🚨 Realtime crises_ativas change:', payload);
          // Refetch immediately for any active crisis change
          setTimeout(() => fetchActiveCrises(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crise_ticket_links'
        },
        (payload) => {
          console.log('🔗 Realtime crisis-ticket link change:', payload);
          // Refetch immediately when tickets are linked/unlinked
          setTimeout(() => fetchActiveCrises(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crise_updates'
        },
        (payload) => {
          console.log('📝 Realtime crisis update change:', payload);
          // Refetch immediately for any update
          setTimeout(() => fetchActiveCrises(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: 'prioridade=eq.crise'
        },
        (payload) => {
          console.log('🎫 Realtime crisis ticket change:', payload);
          // Refetch when any ticket becomes/stops being a crisis
          setTimeout(() => fetchActiveCrises(), 200);
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds to ensure data consistency
    const autoRefresh = setInterval(() => {
      console.log('🔄 Auto-refreshing crisis data...');
      fetchActiveCrises();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(autoRefresh);
    };
  }, []);

  return {
    activeCrises,
    loading,
    createCrisis,
    addTicketsToCrisis,
    updateCrisisStatus,
    broadcastMessage,
    resolveCrisisAndCloseTickets,
    refetch: fetchActiveCrises
  };
};
