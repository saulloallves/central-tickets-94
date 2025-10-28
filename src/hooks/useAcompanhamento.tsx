import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Acompanhamento {
  id: string;
  unidade_id: string;
  codigo_grupo: string;
  status: 'em_acompanhamento' | 'reuniao_agendada' | 'proximas_reunioes' | 'reunioes_dia' | 'plano_criado';
  reuniao_inicial_data: string | null;
  responsavel_reuniao_id: string | null;
  responsavel_reuniao_nome: string | null;
  reuniao_confirmada: boolean;
  reuniao_proxima_data: string | null;
  em_acompanhamento: boolean;
  plano_acao_id: string | null;
  created_at: string;
  updated_at: string;
  finalizado_em: string | null;
  unidade?: {
    id: string;
    grupo: string;
    codigo_grupo: string;
    fantasy_name: string;
    cidade: string;
    estado: string;
  };
}

export function useAcompanhamento() {
  const [acompanhamentos, setAcompanhamentos] = useState<Acompanhamento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAcompanhamentos = async () => {
    try {
      setLoading(true);

      // Fetch acompanhamentos
      const { data: acompanhamentosData, error: acompanhamentosError } = await supabase
        .from('unidades_acompanhamento' as any)
        .select('*')
        .eq('em_acompanhamento', true)
        .order('created_at', { ascending: false });

      if (acompanhamentosError) throw acompanhamentosError;

      // Fetch unidades data
      const codigosGrupo = (acompanhamentosData as any[])?.map((a: any) => a.codigo_grupo) || [];
      const { data: unidadesData, error: unidadesError } = await supabase
        .from('unidades')
        .select('id, grupo, codigo_grupo, fantasy_name, cidade, estado')
        .in('codigo_grupo', codigosGrupo);

      if (unidadesError) throw unidadesError;

      // Combine data
      const combined = (acompanhamentosData as any[])?.map((acomp: any) => {
        const unidade = unidadesData?.find((u: any) => u.codigo_grupo === acomp.codigo_grupo);
        return {
          ...acomp,
          unidade
        } as Acompanhamento;
      }) || [];

      setAcompanhamentos(combined);

      // Setup realtime subscription
      const channel = supabase
        .channel('unidades_acompanhamento_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'unidades_acompanhamento'
          },
          () => {
            fetchAcompanhamentos();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error fetching acompanhamentos:', error);
      toast.error('Erro ao carregar acompanhamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcompanhamentos();
  }, []);

  const addUnidade = async (codigoGrupo: string) => {
    try {
      // Verificar se a unidade existe
      const { data: unidade, error: unidadeError } = await supabase
        .from('unidades')
        .select('id, codigo_grupo, grupo')
        .eq('codigo_grupo', codigoGrupo)
        .single();

      if (unidadeError || !unidade) {
        toast.error('Unidade não encontrada');
        return false;
      }

      // Verificar se já está em acompanhamento
      const { data: existing } = await supabase
        .from('unidades_acompanhamento' as any)
        .select('id')
        .eq('codigo_grupo', codigoGrupo)
        .eq('em_acompanhamento', true)
        .single();

      if (existing) {
        toast.error('Unidade já está em acompanhamento');
        return false;
      }

      // Adicionar ao acompanhamento
      const { error: insertError } = await supabase
        .from('unidades_acompanhamento' as any)
        .insert({
          unidade_id: unidade.id,
          codigo_grupo: codigoGrupo,
          status: 'em_acompanhamento',
          em_acompanhamento: true
        });

      if (insertError) throw insertError;

      toast.success('Unidade adicionada ao acompanhamento');
      await fetchAcompanhamentos();
      return true;
    } catch (error) {
      console.error('Error adding unidade:', error);
      toast.error('Erro ao adicionar unidade');
      return false;
    }
  };

  const agendarReuniao = async (
    acompanhamentoId: string,
    reuniaoData: string,
    responsavelId: string,
    responsavelNome: string
  ) => {
    try {
      const { error } = await supabase
        .from('unidades_acompanhamento' as any)
        .update({
          reuniao_inicial_data: reuniaoData,
          responsavel_reuniao_id: responsavelId,
          responsavel_reuniao_nome: responsavelNome,
          status: 'reuniao_agendada',
          updated_at: new Date().toISOString()
        })
        .eq('id', acompanhamentoId);

      if (error) throw error;

      toast.success('Reunião agendada com sucesso');
      await fetchAcompanhamentos();
      return true;
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      toast.error('Erro ao agendar reunião');
      return false;
    }
  };

  const updateStatus = async (acompanhamentoId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('unidades_acompanhamento' as any)
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', acompanhamentoId);

      if (error) throw error;

      await fetchAcompanhamentos();
      return true;
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
      return false;
    }
  };

  const confirmarReuniao = async (acompanhamentoId: string) => {
    try {
      const { error } = await supabase
        .from('unidades_acompanhamento' as any)
        .update({
          reuniao_confirmada: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', acompanhamentoId);

      if (error) throw error;

      toast.success('Reunião confirmada');
      await fetchAcompanhamentos();
      return true;
    } catch (error) {
      console.error('Error confirming meeting:', error);
      toast.error('Erro ao confirmar reunião');
      return false;
    }
  };

  const finalizarAcompanhamento = async (acompanhamentoId: string) => {
    try {
      const { error } = await supabase
        .from('unidades_acompanhamento' as any)
        .update({
          em_acompanhamento: false,
          status: 'plano_criado',
          finalizado_em: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', acompanhamentoId);

      if (error) throw error;

      toast.success('Acompanhamento finalizado');
      await fetchAcompanhamentos();
      return true;
    } catch (error) {
      console.error('Error finalizing acompanhamento:', error);
      toast.error('Erro ao finalizar acompanhamento');
      return false;
    }
  };

  return {
    acompanhamentos,
    loading,
    addUnidade,
    agendarReuniao,
    updateStatus,
    confirmarReuniao,
    finalizarAcompanhamento,
    refetch: fetchAcompanhamentos
  };
}
