import { useEffect, useState, useRef } from 'react';
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
  const reconnectAttemptsRef = useRef<number>(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

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
    
    // Reset reconnect attempts on fresh setup
    reconnectAttemptsRef.current = 0;

    const channelName = `atendimentos-realtime-${Math.random().toString(36).substr(2, 9)}`;
    console.log('📡 Creating channel:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chamados'
        },
        (payload) => {
          console.log('📡 Realtime chamados event:', payload);
          
          if (payload.eventType === 'INSERT') {
            const atendimento = formatAtendimento(payload.new);
            if (filterAtendimentoEvent(atendimento)) {
              onAtendimentoInsert(atendimento);
            }
          } else if (payload.eventType === 'UPDATE') {
            const atendimento = formatAtendimento(payload.new);
            if (filterAtendimentoEvent(atendimento)) {
              onAtendimentoUpdate(atendimento);
            }
          } else if (payload.eventType === 'DELETE') {
            onAtendimentoDelete(payload.old.id);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('📡 Enhanced atendimento realtime status:', status, err);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Enhanced atendimento realtime connected successfully');
          setIsConnected(true);
          reconnectAttemptsRef.current = 0; // Reset on success
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('❌ Enhanced atendimento realtime connection failed:', status, err);
          setIsConnected(false);
          
          // Limit reconnection attempts
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            console.log(`🔁 Will retry atendimento connection (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          } else {
            console.error(`❌ Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached for atendimentos. Stopping reconnection.`);
          }
        } else if (status === 'CLOSED') {
          console.log('⚠️ Enhanced atendimento realtime connection closed');
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