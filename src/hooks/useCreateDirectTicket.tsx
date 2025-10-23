import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DirectTicketData {
  titulo: string;
  descricao_problema: string;
  codigo_grupo: string;
  equipe_id?: string;
  prioridade?: 'baixo' | 'medio' | 'alto' | 'imediato' | 'crise';
  categoria?: string;
  franqueado_id?: string;
}

export const useCreateDirectTicket = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ticketData: DirectTicketData) => {
      const { data, error } = await supabase.functions.invoke('create-ticket-direct', {
        body: ticketData,
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar ticket');
      }

      return data.ticket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket criado com sucesso!', {
        description: `Ticket #${ticket.id.slice(0, 8)} foi criado`,
      });
    },
    onError: (error: Error) => {
      console.error('Error creating ticket:', error);
      toast.error('Erro ao criar ticket', {
        description: error.message,
      });
    },
  });
};
