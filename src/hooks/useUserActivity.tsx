import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface TicketInteraction {
  ticket_id: string;
  codigo_ticket: string;
  created_at: string;
  mensagem_preview: string;
}

interface UserActivity {
  ticketsAtendidos: number;
  respostasEnviadas: number;
  ultimasInteracoes: TicketInteraction[];
}

export const useUserActivity = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activity, setActivity] = useState<UserActivity>({
    ticketsAtendidos: 0,
    respostasEnviadas: 0,
    ultimasInteracoes: []
  });
  const [loading, setLoading] = useState(true);

  const fetchUserActivity = async () => {
    if (!user) {
      setActivity({
        ticketsAtendidos: 0,
        respostasEnviadas: 0,
        ultimasInteracoes: []
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Buscar contagem de tickets atendidos (distinct)
      const { count: ticketsCount } = await supabase
        .from('ticket_mensagens')
        .select('ticket_id', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .eq('direcao', 'saida');

      // Buscar total de respostas enviadas
      const { count: respostasCount } = await supabase
        .from('ticket_mensagens')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', user.id)
        .eq('direcao', 'saida');

      // Buscar últimas interações com detalhes do ticket
      const { data: interacoes, error: interacoesError } = await supabase
        .from('ticket_mensagens')
        .select(`
          ticket_id,
          created_at,
          mensagem,
          tickets!inner (
            codigo_ticket
          )
        `)
        .eq('usuario_id', user.id)
        .eq('direcao', 'saida')
        .order('created_at', { ascending: false })
        .limit(5);

      if (interacoesError) {
        console.error('Error fetching interactions:', interacoesError);
      }

      const ultimasInteracoes: TicketInteraction[] = (interacoes || []).map(item => ({
        ticket_id: item.ticket_id,
        codigo_ticket: (item.tickets as any)?.codigo_ticket || 'N/A',
        created_at: item.created_at,
        mensagem_preview: item.mensagem?.substring(0, 100) + (item.mensagem?.length > 100 ? '...' : '') || ''
      }));

      setActivity({
        ticketsAtendidos: ticketsCount || 0,
        respostasEnviadas: respostasCount || 0,
        ultimasInteracoes
      });

    } catch (error) {
      console.error('Error fetching user activity:', error);
      // Não mostrar toast para evitar spam, apenas log
      setActivity({
        ticketsAtendidos: 0,
        respostasEnviadas: 0,
        ultimasInteracoes: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserActivity();
  }, [user?.id]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-activity-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_mensagens',
          filter: `usuario_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New message by user:', payload);
          fetchUserActivity();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    activity,
    loading,
    refetch: fetchUserActivity
  };
};