import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAIAlertSystem } from '@/hooks/useAIAlertSystem';

interface FAQResponse {
  resposta_ia_sugerida: string;
  log_prompt_faq: any;
  articles_found: number;
}

export const useFAQSuggestion = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { wrapAIFunction } = useAIAlertSystem();

  const getSuggestion = async (pergunta: string): Promise<FAQResponse | null> => {
    if (!pergunta.trim()) return null;

    setLoading(true);
    try {
      console.log('Getting FAQ suggestion for:', pergunta);
      
      const data = await wrapAIFunction(
        'FAQ-Suggest-AI',
        'hooks/useFAQSuggestion/getSuggestion',
        async () => {
          const { data, error } = await supabase.functions.invoke('faq-suggest', {
            body: { pergunta }
          });

          if (error) {
            console.error('FAQ suggestion error:', error);
            throw error;
          }

          if (!data || !data.resposta_ia_sugerida) {
            throw new Error('Resposta vazia da IA FAQ');
          }

          return data;
        },
        undefined,
        undefined,
        { pergunta }
      );

      console.log('FAQ suggestion received:', data);
      return data;
    } catch (error) {
      console.error('Error in FAQ suggestion:', error);
      toast({
        title: "Erro na Sugestão",
        description: "Não foi possível obter sugestão da IA",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const logFAQInteraction = async (
    pergunta: string,
    resposta: string,
    logPromptFaq: any,
    usarRespostaSimples: boolean,
    justificativa?: string,
    ticketId?: string
  ) => {
    try {
      const { error } = await supabase
        .from('faq_logs')
        .insert({
          pergunta_usuario: pergunta,
          resposta_ia_sugerida: resposta,
          usar_resposta_simples: usarRespostaSimples,
          justificativa_abertura: justificativa,
          log_prompt_faq: logPromptFaq,
          ticket_id: ticketId,
          usuario_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) {
        console.error('Error logging FAQ interaction:', error);
      } else {
        console.log('FAQ interaction logged successfully');
      }
    } catch (error) {
      console.error('Error in FAQ logging:', error);
    }
  };

  return {
    getSuggestion,
    logFAQInteraction,
    loading
  };
};