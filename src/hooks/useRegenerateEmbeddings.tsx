import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useRegenerateEmbeddings = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const regenerateEmbeddings = async () => {
    setLoading(true);
    try {
      console.log('🔄 Iniciando regeneração de embeddings...');
      
      const { data, error } = await supabase.functions.invoke('regenerate-embeddings', {
        body: {}
      });

      if (error) {
        throw error;
      }

      console.log('✅ Resposta da regeneração:', data);

      toast({
        title: "Embeddings Regenerados",
        description: `${data.processedCount} documentos processados com sucesso. ${data.errorCount} erros.`,
      });

      return data;
    } catch (error) {
      console.error('❌ Erro na regeneração:', error);
      toast({
        title: "Erro na Regeneração",
        description: "Falha ao regenerar embeddings dos documentos",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    regenerateEmbeddings,
    loading
  };
};