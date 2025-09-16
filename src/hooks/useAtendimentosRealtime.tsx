import { useEffect } from 'react';
import { useEnhancedAtendimentoRealtime } from './useEnhancedAtendimentoRealtime';

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

interface UseAtendimentosRealtimeProps {
  onAtendimentoUpdate: (atendimento: Atendimento) => void;
  onAtendimentoInsert: (atendimento: Atendimento) => void;
  onAtendimentoDelete: (atendimentoId: string) => void;
  filters?: {
    unidade_id?: string;
    status?: string[];
  };
}

export const useAtendimentosRealtime = ({
  onAtendimentoUpdate,
  onAtendimentoInsert,
  onAtendimentoDelete,
  filters
}: UseAtendimentosRealtimeProps) => {
  
  // Use the enhanced realtime hook
  const { isConnected } = useEnhancedAtendimentoRealtime({
    onAtendimentoUpdate,
    onAtendimentoInsert,
    onAtendimentoDelete,
    filters
  });

  return {
    isConnected
  };
};