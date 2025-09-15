import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Atendimento {
  id: string;
  unidade_id: string;
  franqueado_nome: string;
  telefone: string;
  descricao: string;
  categoria?: string;
  prioridade: string;
  status: string;
  tipo_atendimento: string;
  atendente_id?: string;
  atendente_nome?: string;
  resolucao?: string;
  criado_em: string;
  atualizado_em?: string;
}

export function useAtendimentos() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAtendimentos = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('chamados')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('Erro ao buscar atendimentos:', error);
        toast({
          title: "Erro ao carregar atendimentos",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Mapear dados da tabela chamados para o formato esperado
      const atendimentosFormatados = data?.map(chamado => ({
        id: chamado.id,
        unidade_id: chamado.unidade_id,
        franqueado_nome: chamado.franqueado_nome,
        telefone: chamado.telefone,
        descricao: chamado.descricao,
        categoria: chamado.categoria,
        prioridade: chamado.prioridade || 'normal',
        status: chamado.status,
        tipo_atendimento: chamado.tipo_atendimento,
        atendente_id: chamado.atendente_id,
        atendente_nome: chamado.atendente_nome,
        resolucao: chamado.resolucao,
        criado_em: chamado.criado_em,
        atualizado_em: chamado.atualizado_em,
      })) || [];

      setAtendimentos(atendimentosFormatados);
    } catch (error) {
      console.error('Erro ao buscar atendimentos:', error);
      toast({
        title: "Erro ao carregar atendimentos",
        description: "Erro inesperado ao carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAtendimentos = () => {
    fetchAtendimentos();
  };

  useEffect(() => {
    fetchAtendimentos();

    // Configurar realtime para atualizações da tabela chamados
    const channel = supabase
      .channel('chamados-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chamados'
        },
        (payload) => {
          console.log('📡 Realtime atendimentos update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const novoAtendimento = {
              id: payload.new.id,
              unidade_id: payload.new.unidade_id,
              franqueado_nome: payload.new.franqueado_nome,
              telefone: payload.new.telefone,
              descricao: payload.new.descricao,
              categoria: payload.new.categoria,
              prioridade: payload.new.prioridade || 'normal',
              status: payload.new.status,
              tipo_atendimento: payload.new.tipo_atendimento,
              atendente_id: payload.new.atendente_id,
              atendente_nome: payload.new.atendente_nome,
              resolucao: payload.new.resolucao,
              criado_em: payload.new.criado_em,
              atualizado_em: payload.new.atualizado_em,
            };
            
            setAtendimentos(prev => [novoAtendimento, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const atendimentoAtualizado = {
              id: payload.new.id,
              unidade_id: payload.new.unidade_id,
              franqueado_nome: payload.new.franqueado_nome,
              telefone: payload.new.telefone,
              descricao: payload.new.descricao,
              categoria: payload.new.categoria,
              prioridade: payload.new.prioridade || 'normal',
              status: payload.new.status,
              tipo_atendimento: payload.new.tipo_atendimento,
              atendente_id: payload.new.atendente_id,
              atendente_nome: payload.new.atendente_nome,
              resolucao: payload.new.resolucao,
              criado_em: payload.new.criado_em,
              atualizado_em: payload.new.atualizado_em,
            };
            
            setAtendimentos(prev => 
              prev.map(atendimento => 
                atendimento.id === payload.new.id ? atendimentoAtualizado : atendimento
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setAtendimentos(prev => 
              prev.filter(atendimento => atendimento.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    atendimentos,
    loading,
    refreshAtendimentos,
  };
}