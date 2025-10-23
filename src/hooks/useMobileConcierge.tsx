import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConciergeResponse {
  success?: boolean;
  message?: string;
  posicao_fila?: number;
  atendimento_existente?: boolean;
  fora_do_horario?: boolean;
  error?: string;
}

export const useMobileConcierge = () => {
  const [isLoading, setIsLoading] = useState(false);

  const solicitarConcierge = async (idGrupoBranco: string, codigoGrupo: string) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('concierge_falar', {
        body: { 
          phone: idGrupoBranco,
          silent_mode: false 
        }
      });

      if (error) throw error;

      const response = data as ConciergeResponse;

      if (response.fora_do_horario) {
        toast.info('Fora do horário', {
          description: 'Atendimento: Seg-Sáb, 8h30-17h30. Abra um ticket para ser atendido depois.'
        });
        return { success: false };
      }

      if (response.atendimento_existente) {
        if (response.posicao_fila && response.posicao_fila > 0) {
          toast.info('Você já está na fila', {
            description: `Posição na fila: ${response.posicao_fila}º`
          });
        } else {
          toast.info('Atendimento em andamento', {
            description: 'Você já está sendo atendido pelo Concierge.'
          });
        }
        return { success: false };
      }

      if (response.success) {
        const posicao = response.posicao_fila || 1;
        toast.success('Solicitação enviada!', {
          description: `Você está na posição ${posicao}º da fila. Aguarde o atendimento no WhatsApp.`
        });
        return { success: true };
      }

      toast.error('Erro ao solicitar Concierge', {
        description: response.message || 'Tente novamente em instantes.'
      });
      return { success: false };

    } catch (error) {
      console.error('Erro ao chamar concierge_falar:', error);
      toast.error('Erro de conexão', {
        description: 'Não foi possível conectar ao serviço. Verifique sua internet e tente novamente.'
      });
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  return { solicitarConcierge, isLoading };
};
