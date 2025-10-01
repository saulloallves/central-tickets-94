import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AtendenteConfig {
  id: string;
  nome: string;
  telefone: string | null;
  tipo: 'concierge' | 'dfcom';
}

export const useAtendenteUnidadesBulk = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchAtendentesByTipo = async (tipo: 'concierge' | 'dfcom'): Promise<AtendenteConfig[]> => {
    try {
      const { data, error } = await supabase
        .from('atendentes')
        .select('id, nome, telefone, tipo')
        .eq('tipo', tipo)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar atendentes:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os atendentes",
        variant: "destructive"
      });
      return [];
    }
  };

  const updateAtendente = async (
    id: string,
    nome: string,
    telefone: string
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('atendentes')
        .update({
          nome,
          telefone
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Atualizar também os campos legados em atendente_unidades para manter compatibilidade
      await supabase
        .from('atendente_unidades')
        .update({
          concierge_name: nome,
          concierge_phone: telefone
        })
        .eq('atendente_id', id);

      toast({
        title: "Atualizado com sucesso",
        description: "Atendente atualizado em todas as unidades vinculadas"
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

  const createAtendente = async (
    nome: string,
    telefone: string,
    tipo: 'concierge' | 'dfcom'
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('atendentes')
        .insert({
          nome,
          telefone,
          tipo,
          status: 'ativo',
          capacidade_maxima: 5,
          capacidade_atual: 0,
          ativo: true
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Criado com sucesso",
        description: "Novo atendente criado"
      });

      return data;
    } catch (error) {
      console.error('Erro ao criar atendente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o atendente",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchAtendentesByTipo,
    updateAtendente,
    createAtendente
  };
};
