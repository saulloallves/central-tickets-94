import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PlanoAcao {
  id: string;
  codigo_grupo: number;
  codigo_plano?: string;
  titulo: string | null;
  descricao: string | null;
  acoes: string | null;
  status: string | null;
  status_frnq: string | null;
  prazo: string | null;
  responsavel_local: string | null;
  categoria: string | null;
  setor: string | null;
  nome_completo: string | null;
  gpt: string | null;
  upload: string | null;
  created_at: string;
  descricao_andamento: string | null;
  descricao_nao_entendi: string | null;
  desscricao_nao_consegui_realizar: string | null;
  unidade?: {
    name: string;
    grupo: string;
  };
}

export const usePlanoAcao = () => {
  const [planos, setPlanos] = useState<PlanoAcao[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPlanos = async () => {
    try {
      setLoading(true);
      
      // Primeiro buscar planos de ação
      const { data: planosData, error: planosError } = await supabase
        .from('plano_acao')
        .select('*')
        .order('created_at', { ascending: false });

      if (planosError) throw planosError;

      // Buscar unidades separadamente
      const { data: unidadesData, error: unidadesError } = await supabase
        .from('unidades')
        .select('codigo_grupo, fantasy_name, grupo');

      if (unidadesError) throw unidadesError;

      // Mapear unidades por codigo_grupo
      const unidadesMap = new Map(
        (unidadesData || []).map(u => [u.codigo_grupo, { name: u.fantasy_name || '', grupo: u.grupo || '' }])
      );

      // Combinar dados
      const transformedData = (planosData || []).map((plano) => ({
        ...plano,
        unidade: unidadesMap.get(String(plano.codigo_grupo))
      }));

      setPlanos(transformedData);
    } catch (error: any) {
      console.error('Error fetching planos:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar planos',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatusFrnq = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('plano_acao')
        .update({ status_frnq: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: 'O status do plano foi atualizado com sucesso.'
      });

      await fetchPlanos();
      return true;
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: error.message
      });
      return false;
    }
  };

  useEffect(() => {
    fetchPlanos();

    // Realtime subscription
    const channel = supabase
      .channel('plano_acao_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plano_acao'
        },
        () => {
          fetchPlanos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updatePlano = async (id: string, data: Partial<PlanoAcao>) => {
    try {
      const { data: result, error } = await supabase.functions.invoke(
        'update-plano-acao',
        { body: { id, ...data } }
      );
      
      if (error) throw error;
      
      toast({
        title: 'Plano atualizado',
        description: 'As alterações foram salvas e notificação enviada.'
      });
      
      await fetchPlanos();
      return true;
    } catch (error: any) {
      console.error('Error updating plano:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: error.message
      });
      return false;
    }
  };

  return {
    planos,
    loading,
    updateStatusFrnq,
    updatePlano,
    refetch: fetchPlanos
  };
};
