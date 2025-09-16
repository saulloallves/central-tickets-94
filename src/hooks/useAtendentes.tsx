import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Atendente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  tipo: 'concierge' | 'dfcom';
  status: 'ativo' | 'pausa' | 'almoco' | 'indisponivel' | 'inativo';
  horario_inicio?: string;
  horario_fim?: string;
  capacidade_maxima: number;
  capacidade_atual: number;
  foto_perfil?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  atendente_unidades?: {
    unidade_id: string;
    is_preferencial: boolean;
    prioridade: number;
    ativo: boolean;
  }[];
}

export const useAtendentes = () => {
  const { toast } = useToast();
  const [atendentes, setAtendentes] = useState<Atendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchAtendentes = async (useExternal = false) => {
    try {
      const action = useExternal ? 'list_external' : 'list'
      const { data, error } = await supabase.functions.invoke('manage-atendentes', {
        body: { action }
      });

      if (error) throw error;
      setAtendentes(data.data || []);
    } catch (error) {
      console.error('Error fetching atendentes:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os atendentes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createAtendente = async (data: Partial<Atendente>) => {
    try {
      setUpdating('creating');
      const { data: result, error } = await supabase.functions.invoke('manage-atendentes', {
        body: { action: 'create', data }
      });

      if (error) throw error;

      await fetchAtendentes();
      toast({
        title: "Sucesso",
        description: "Atendente criado com sucesso",
      });

      return result.data;
    } catch (error) {
      console.error('Error creating atendente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o atendente",
        variant: "destructive",
      });
      throw error;
    } finally {
      setUpdating(null);
    }
  };

  const updateAtendente = async (id: string, data: Partial<Atendente>) => {
    try {
      setUpdating(id);
      const { data: result, error } = await supabase.functions.invoke('manage-atendentes', {
        body: { action: 'update', id, data }
      });

      if (error) throw error;

      await fetchAtendentes();
      toast({
        title: "Sucesso",
        description: "Atendente atualizado com sucesso",
      });

      return result.data;
    } catch (error) {
      console.error('Error updating atendente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o atendente",
        variant: "destructive",
      });
      throw error;
    } finally {
      setUpdating(null);
    }
  };

  const deleteAtendente = async (id: string) => {
    try {
      setUpdating(id);
      const { error } = await supabase.functions.invoke('manage-atendentes', {
        body: { action: 'delete', id }
      });

      if (error) throw error;

      await fetchAtendentes();
      toast({
        title: "Sucesso",
        description: "Atendente removido com sucesso",
      });
    } catch (error) {
      console.error('Error deleting atendente:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o atendente",
        variant: "destructive",
      });
      throw error;
    } finally {
      setUpdating(null);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      setUpdating(id);
      const { error } = await supabase.functions.invoke('manage-atendentes', {
        body: { action: 'update_status', id, data: { status } }
      });

      if (error) throw error;

      await fetchAtendentes();
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
      throw error;
    } finally {
      setUpdating(null);
    }
  };

  const redistributeQueue = async (tipo: 'concierge' | 'dfcom', unidade_id: string, motivo?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('redistribute-queue', {
        body: { tipo, unidade_id, motivo }
      });

      if (error) throw error;

      toast({
        title: "Redistribuição Concluída",
        description: `${data.redistributed} chamados redistribuídos para ${data.available_agents} atendentes`,
      });

      return data;
    } catch (error) {
      console.error('Error redistributing queue:', error);
      toast({
        title: "Erro",
        description: "Não foi possível redistribuir a fila",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getCapacity = async (tipo: 'concierge' | 'dfcom', unidade_id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-atendentes', {
        body: { action: 'get_capacity', data: { tipo, unidade_id } }
      });

      if (error) throw error;
      return data.capacity;
    } catch (error) {
      console.error('Error getting capacity:', error);
      return 0;
    }
  };

  useEffect(() => {
    fetchAtendentes(true); // Use external data by default
    
    // Realtime subscription
    const channel = supabase
      .channel('atendentes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atendentes'
        },
        () => {
          fetchAtendentes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    atendentes,
    loading,
    updating,
    createAtendente,
    updateAtendente,
    deleteAtendente,
    updateStatus,
    redistributeQueue,
    getCapacity,
    refetch: () => fetchAtendentes(true) // Use external data
  };
};