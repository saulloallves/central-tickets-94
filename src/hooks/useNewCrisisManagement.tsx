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

  const fetchActiveCrises = async (isRefetch = false) => {
    try {
      // Only set loading on initial fetch, not on refetches
      if (!isRefetch) {
        setLoading(true);
      }
      
      // Buscar apenas da tabela crises (novo sistema unificado)
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
              unidades (
                grupo,
                cidade,
                uf
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
        .not('status', 'in', '(resolvido,encerrado)')
        .order('created_at', { ascending: false });

      if (crisesError) {
        console.error('Error fetching crises:', crisesError);
        // Apenas log o erro, não mostrar toast para evitar spam
        if (crisesError.code !== 'PGRST116') { // Ignore empty result errors
          console.warn('Crisis fetch error (non-critical):', crisesError.message);
        }
        setActiveCrises([]);
        return;
      }

      setActiveCrises(crisesData || []);
      console.log('🚨 Active crises loaded:', (crisesData || []).length);
    } catch (error) {
      console.error('Error fetching active crises:', error);
      setActiveCrises([]);
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

      await fetchActiveCrises(true);
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

      await fetchActiveCrises(true);
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

      await fetchActiveCrises(true);
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

      await fetchActiveCrises(true);
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
      const { error } = await supabase.rpc('resolve_crise_close_tickets', {
        p_crise_id: crisisId,
        p_mensagem: mensagem,
        p_status_ticket: 'concluido' // Sempre marcar como concluído
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

      toast({
        title: "✅ Crise Encerrada",
        description: "A crise foi encerrada e todos os tickets foram movidos para 'Concluído'",
      });

      await fetchActiveCrises(true);
      
      // Disparar evento para atualizar lista de tickets
      window.dispatchEvent(new CustomEvent('crisis-resolved'));
      
      return true;
    } catch (error) {
      console.error('Error resolving crisis:', error);
      return false;
    }
  };

  const unlinkTicketFromCrisis = async (crisisId: string, ticketId: string) => {
    try {
      const { error } = await supabase.rpc('unlink_ticket_from_crisis', {
        p_crise_id: crisisId,
        p_ticket_id: ticketId
      });

      if (error) {
        console.error('Error unlinking ticket from crisis:', error);
        toast({
          title: "Erro",
          description: "Não foi possível desvincular o ticket da crise",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Ticket Desvinculado",
        description: "O ticket foi desvinculado da crise com sucesso",
      });

      await fetchActiveCrises(true);
      return true;
    } catch (error) {
      console.error('Error unlinking ticket from crisis:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchActiveCrises();

    // Escutar evento de crise detectada para refresh automático
    const handleCrisisDetected = () => {
      console.log('🚨 Crise detectada automaticamente - atualizando painel');
      fetchActiveCrises(true);
    };

    window.addEventListener('crisis-detected', handleCrisisDetected);

    // Realtime subscription apenas para a tabela crises
    const channel = supabase
      .channel('crises-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crises'
        },
        (payload) => {
          console.log('🚨 Realtime crisis change:', payload);
          setTimeout(() => fetchActiveCrises(true), 100);
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
          setTimeout(() => fetchActiveCrises(true), 100);
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
          setTimeout(() => fetchActiveCrises(true), 100);
        }
      )
      .subscribe();

    // Auto-refresh every 60 seconds to ensure data consistency (reduced frequency)
    const autoRefresh = setInterval(() => {
      console.log('🔄 Auto-refreshing crisis data...');
      fetchActiveCrises(true); // Mark as refetch to avoid loading state
    }, 60000);

    return () => {
      window.removeEventListener('crisis-detected', handleCrisisDetected);
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
    unlinkTicketFromCrisis,
    refetch: () => fetchActiveCrises(true)
  };
};
