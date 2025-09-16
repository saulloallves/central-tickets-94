import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

interface EnhancedAtendimentoRealtimeOptions {
  onAtendimentoUpdate: (atendimento: Atendimento) => void;
  onAtendimentoInsert: (atendimento: Atendimento) => void;
  onAtendimentoDelete: (atendimentoId: string) => void;
  filters?: {
    unidade_id?: string;
    status?: string[];
  };
}

export const useEnhancedAtendimentoRealtime = ({
  onAtendimentoUpdate,
  onAtendimentoInsert,
  onAtendimentoDelete,
  filters
}: EnhancedAtendimentoRealtimeOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [hasAttemptedRealtime, setHasAttemptedRealtime] = useState(false);
  const { user } = useAuth();

  const formatAtendimento = (chamado: any): Atendimento => ({
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
  });

  const filterAtendimentoEvent = (atendimento: Atendimento): boolean => {
    if (!filters) return true;

    // Filter by unidade_id
    if (filters.unidade_id && atendimento.unidade_id !== filters.unidade_id) {
      return false;
    }

    // Filter by status
    if (filters.status && filters.status.length > 0 && !filters.status.includes(atendimento.status)) {
      return false;
    }

    return true;
  };

  useEffect(() => {
    if (!user) {
      console.log('📡 No user authenticated, skipping realtime setup');
      return;
    }

    console.log('📡 Setting up enhanced atendimento realtime with filters:', filters);
    setHasAttemptedRealtime(true);

    const channel = supabase
      .channel('enhanced-atendimentos-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chamados'
        },
        (payload) => {
          console.log('📡 Realtime INSERT atendimento:', payload);
          const atendimento = formatAtendimento(payload.new);
          
          if (filterAtendimentoEvent(atendimento)) {
            onAtendimentoInsert(atendimento);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chamados'
        },
        (payload) => {
          console.log('📡 Realtime UPDATE atendimento:', payload);
          const atendimento = formatAtendimento(payload.new);
          
          if (filterAtendimentoEvent(atendimento)) {
            onAtendimentoUpdate(atendimento);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chamados'
        },
        (payload) => {
          console.log('📡 Realtime DELETE atendimento:', payload);
          onAtendimentoDelete(payload.old.id);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Enhanced atendimento realtime status:', status, err);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Enhanced atendimento realtime connected successfully');
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.log('❌ Enhanced atendimento realtime connection failed:', status, err);
          setIsConnected(false);
        }
      });

    // Cleanup function
    return () => {
      console.log('🔌 Cleaning up enhanced atendimento realtime subscription');
      setIsConnected(false);
      supabase.removeChannel(channel);
    };
  }, [user, JSON.stringify(filters)]);

  return {
    isConnected,
    hasAttemptedRealtime
  };
};