
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CrisisActive {
  id: string;
  ticket_id: string;
  motivo: string;
  criada_por: string | null;
  criada_em: string;
  resolvida_em: string | null;
  resolvida_por: string | null;
  log_acoes: any[];
  impacto_regional: string[];
  comunicado_emitido: boolean;
  // Relations
  tickets?: {
    codigo_ticket: string;
    titulo: string;
    descricao_problema: string;
    unidade_id: string;
    prioridade: string;
    status: string;
    unidades?: {
      grupo: string;
    };
  };
}

export const useCrisisManagement = () => {
  const [activeCrises, setActiveCrises] = useState<CrisisActive[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchActiveCrises = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('crises_ativas')
        .select(`
          *,
          tickets:ticket_id (
            codigo_ticket,
            titulo,
            descricao_problema,
            unidade_id,
            prioridade,
            status
          )
        `)
        .is('resolvida_em', null)
        .order('criada_em', { ascending: false });

      if (error) {
        console.error('Error fetching active crises:', error);
        // Apenas log o erro, não mostrar toast para evitar spam  
        if (error.code !== 'PGRST116') { // Ignore empty result errors
          console.warn('Legacy crisis fetch error (non-critical):', error.message);
        }
        setActiveCrises([]);
        return;
      }

      // Transform the data to ensure log_acoes is always an array
      const transformedData = (data || []).map(crisis => ({
        ...crisis,
        log_acoes: Array.isArray(crisis.log_acoes) ? crisis.log_acoes : []
      }));

      setActiveCrises(transformedData);
    } catch (error) {
      console.error('Error fetching active crises:', error);
      setActiveCrises([]);
    } finally {
      setLoading(false);
    }
  };

  const resolveCrisis = async (crisisId: string) => {
    try {
      const { error } = await supabase.rpc('resolve_crisis', {
        p_crisis_id: crisisId,
        p_resolvida_por: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) {
        console.error('Error resolving crisis:', error);
        toast({
          title: "Erro",
          description: "Não foi possível resolver a crise",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "✅ Crise Resolvida",
        description: "A crise foi marcada como resolvida com sucesso",
      });

      await fetchActiveCrises();
      return true;
    } catch (error) {
      console.error('Error resolving crisis:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao resolver crise",
        variant: "destructive",
      });
      return false;
    }
  };

  const logCrisisAction = async (crisisId: string, acao: string, meta: any = {}) => {
    try {
      const { error } = await supabase.rpc('log_crisis_action', {
        p_crisis_id: crisisId,
        p_acao: acao,
        p_by: (await supabase.auth.getUser()).data.user?.id,
        p_meta: meta
      });

      if (error) {
        console.error('Error logging crisis action:', error);
        return false;
      }

      fetchActiveCrises();
      return true;
    } catch (error) {
      console.error('Error logging crisis action:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchActiveCrises();

    // Realtime subscription for active crises (legacy system)
    const channel = supabase
      .channel('legacy-crises-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crises_ativas'
        },
        (payload) => {
          console.log('Legacy crisis change:', payload);
          setTimeout(() => fetchActiveCrises(), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    activeCrises,
    loading,
    resolveCrisis,
    logCrisisAction,
    refetch: fetchActiveCrises
  };
};
