import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAtendimentosRealtime } from './useAtendimentosRealtime';

interface Atendimento {
  id: string;
  unidade_id: string;
  unidade_nome?: string;
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
  is_emergencia?: boolean;
}

export function useAtendimentos() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAtendimentos = async () => {
    try {
      setLoading(true);
      
      // Buscar chamados com JOIN para pegar informações do atendente
      const { data: chamados, error } = await supabase
        .from('chamados')
        .select(`
          *,
          atendentes:atendente_id (
            id,
            nome,
            tipo
          )
        `)
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

      // Buscar informações de unidades para enriquecer os dados
      const unidadeIds = [...new Set(chamados?.map(c => c.unidade_id).filter(Boolean))];
      
      const { data: unidades } = await supabase
        .from('atendente_unidades')
        .select('id, grupo')
        .in('id', unidadeIds);

      const unidadeMap = new Map(unidades?.map(u => [u.id, u.grupo]) || []);

      // Mapear dados da tabela chamados para o formato esperado
      const atendimentosFormatados = chamados?.map(chamado => ({
        id: chamado.id,
        unidade_id: chamado.unidade_id,
        unidade_nome: unidadeMap.get(chamado.unidade_id) || 'Unidade não identificada',
        franqueado_nome: chamado.franqueado_nome,
        telefone: chamado.telefone,
        descricao: chamado.descricao,
        categoria: chamado.categoria,
        prioridade: chamado.prioridade || 'normal',
        status: chamado.status,
        tipo_atendimento: chamado.tipo_atendimento,
        atendente_id: chamado.atendente_id,
        // Priorizar nome do JOIN, depois nome salvo, depois fallback
        atendente_nome: chamado.atendentes?.nome || chamado.atendente_nome || 'Sem atendente',
        resolucao: chamado.resolucao,
        criado_em: chamado.criado_em,
        atualizado_em: chamado.atualizado_em,
        is_emergencia: chamado.is_emergencia || false,
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

  // Enhanced realtime subscription
  const { isConnected } = useAtendimentosRealtime({
    onAtendimentoUpdate: (atendimento) => {
      console.log('📡 Real-time UPDATE received:', atendimento);
      setAtendimentos(prev => 
        prev.map(item => 
          item.id === atendimento.id ? atendimento : item
        )
      );
    },
    onAtendimentoInsert: (atendimento) => {
      console.log('📡 Real-time INSERT received:', atendimento);
      setAtendimentos(prev => [atendimento, ...prev]);
    },
    onAtendimentoDelete: (atendimentoId) => {
      console.log('📡 Real-time DELETE received:', atendimentoId);
      setAtendimentos(prev => 
        prev.filter(item => item.id !== atendimentoId)
      );
    },
  });

  // Optimistic updates listener
  useEffect(() => {
    const handleOptimisticUpdate = (event: CustomEvent) => {
      const { atendimento } = event.detail;
      console.log('⚡ Optimistic update:', atendimento);
      
      setAtendimentos(prev => 
        prev.map(item => 
          item.id === atendimento.id ? atendimento : item
        )
      );
    };

    window.addEventListener('atendimento-optimistic-update', handleOptimisticUpdate as EventListener);
    
    return () => {
      window.removeEventListener('atendimento-optimistic-update', handleOptimisticUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    fetchAtendimentos();
  }, []);

  return {
    atendimentos,
    loading,
    refreshAtendimentos,
    isConnected,
  };
}