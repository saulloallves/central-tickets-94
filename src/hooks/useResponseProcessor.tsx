import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface ProcessResponseResult {
  resposta_corrigida: string;
  avaliacao_documentacao: {
    pode_documentar: boolean;
    classificacao: string;
    resultado: string;
  };
  pode_virar_documento: boolean;
}

export const useResponseProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processResponse = async (
    mensagem: string, 
    ticketId: string, 
    usuarioId: string
  ): Promise<{ respostaFinal: string; processData?: ProcessResponseResult }> => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-response', {
        body: {
          mensagem,
          ticket_id: ticketId,
          usuario_id: usuarioId
        }
      });

      if (error) {
        console.error('Erro ao processar resposta:', error);
        toast({
          title: "Erro no processamento",
          description: "Usando resposta original. Erro: " + error.message,
          variant: "destructive"
        });
        return { respostaFinal: mensagem };
      }

      const result = data as ProcessResponseResult;
      
      // Mostrar notificação baseada no resultado
      if (result.pode_virar_documento) {
        toast({
          title: "✨ Resposta processada e analisada",
          description: "Resposta corrigida e enviada para avaliação de documentação",
        });
      } else {
        toast({
          title: "✅ Resposta corrigida",
          description: "Texto padronizado e corrigido",
        });
      }

      return { 
        respostaFinal: result.resposta_corrigida,
        processData: result
      };

    } catch (error) {
      console.error('Erro no processamento:', error);
      toast({
        title: "Erro no processamento",
        description: "Usando resposta original",
        variant: "destructive"
      });
      return { respostaFinal: mensagem };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    processResponse,
    isProcessing
  };
};