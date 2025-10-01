import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UniqueAtendente {
  concierge_name: string;
  concierge_phone: string;
  count: number;
}

export const useAtendenteUnidadesBulk = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchUniqueAtendentes = async (): Promise<UniqueAtendente[]> => {
    try {
      const { data, error } = await supabase
        .from('atendente_unidades')
        .select('concierge_name, concierge_phone')
        .not('concierge_name', 'is', null)
        .not('concierge_phone', 'is', null);

      if (error) throw error;

      // Agrupar manualmente para contar
      const grouped = data.reduce((acc, item) => {
        const key = `${item.concierge_name}|${item.concierge_phone}`;
        if (!acc[key]) {
          acc[key] = {
            concierge_name: item.concierge_name,
            concierge_phone: item.concierge_phone,
            count: 0
          };
        }
        acc[key].count++;
        return acc;
      }, {} as Record<string, UniqueAtendente>);

      return Object.values(grouped);
    } catch (error) {
      console.error('Erro ao buscar atendentes únicos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os atendentes",
        variant: "destructive"
      });
      return [];
    }
  };

  const updateAtendenteInBulk = async (
    oldName: string,
    oldPhone: string,
    newName: string,
    newPhone: string
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('atendente_unidades')
        .update({
          concierge_name: newName,
          concierge_phone: newPhone
        })
        .eq('concierge_name', oldName)
        .eq('concierge_phone', oldPhone)
        .select();

      if (error) throw error;

      toast({
        title: "Atualizado com sucesso",
        description: `${data?.length || 0} registros foram atualizados`
      });

      return data;
    } catch (error) {
      console.error('Erro ao atualizar atendente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o atendente",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchUniqueAtendentes,
    updateAtendenteInBulk
  };
};
