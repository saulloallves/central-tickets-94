import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useTicketResponseMode = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const startTicketResponseMode = async (groupPhone: string, ticketId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-ticket-response-mode', {
        body: {
          group_phone: groupPhone,
          ticket_id: ticketId,
          action: 'start'
        }
      });

      if (error) {
        console.error('❌ Erro ao iniciar modo de resposta:', error);
        toast({
          title: "Erro",
          description: "Erro ao configurar modo de resposta ao ticket",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Modo de resposta iniciado:', data);
      return true;

    } catch (error) {
      console.error('❌ Erro geral ao iniciar modo de resposta:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao configurar modo de resposta",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const stopTicketResponseMode = async (groupPhone: string, ticketId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-ticket-response-mode', {
        body: {
          group_phone: groupPhone,
          ticket_id: ticketId,
          action: 'stop'
        }
      });

      if (error) {
        console.error('❌ Erro ao parar modo de resposta:', error);
        toast({
          title: "Erro",
          description: "Erro ao parar modo de resposta ao ticket",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ Modo de resposta parado:', data);
      return true;

    } catch (error) {
      console.error('❌ Erro geral ao parar modo de resposta:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao parar modo de resposta",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getGroupStates = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_group_states')
        .select('*')
        .eq('awaiting_ticket_response', true);

      if (error) {
        console.error('❌ Erro ao buscar estados dos grupos:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Erro geral ao buscar estados:', error);
      return [];
    }
  };

  return {
    startTicketResponseMode,
    stopTicketResponseMode,
    getGroupStates,
    isLoading
  };
};