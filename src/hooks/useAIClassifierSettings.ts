import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useAIClassifierSettings = () => {
  return useQuery({
    queryKey: ['ai-classifier-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_classifier_advanced_settings')
        .select('priority_matrix')
        .eq('ativo', true)
        .single();

      if (error) {
        console.error('Erro ao buscar configurações do classificador:', error);
        return null;
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });
};
