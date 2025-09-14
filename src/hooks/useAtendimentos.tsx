import { useState, useEffect } from 'react';

// Mock data para demonstração do design
const MOCK_ATENDIMENTOS = [
  {
    id: '1',
    unidade: 'Unidade Centro - SP',
    codigo: 'U001',
    telefone: '(11) 99999-9999',
    contato: 'Maria Silva',
    status: 'em_fila',
    tempoEspera: 15,
    ultimaInteracao: {
      tipo: 'mensagem',
      texto: 'Preciso de ajuda com meu pedido',
      tempo: '2 min'
    }
  },
  {
    id: '2',
    unidade: 'Unidade Norte - RJ',
    codigo: 'U002',
    telefone: '(21) 88888-8888',
    contato: 'João Santos',
    status: 'em_fila',
    tempoEspera: 8,
    ultimaInteracao: {
      tipo: 'automatica',
      texto: 'Resposta automática enviada',
      tempo: '5 min'
    }
  },
  {
    id: '3',
    unidade: 'Unidade Sul - MG',
    codigo: 'U003',
    telefone: '(31) 77777-7777',
    contato: 'Ana Costa',
    status: 'novo',
    tempoEspera: 2,
    ultimaInteracao: {
      tipo: 'mensagem',
      texto: 'Primeira mensagem recebida',
      tempo: '1 min'
    }
  },
  {
    id: '4',
    unidade: 'Unidade Oeste - PR',
    codigo: 'U004',
    telefone: '(41) 66666-6666',
    contato: 'Carlos Oliveira',
    status: 'em_atendimento',
    tempoEspera: 45,
    ultimaInteracao: {
      tipo: 'mensagem',
      texto: 'Aguardando resposta do suporte',
      tempo: '10 min'
    }
  },
  {
    id: '5',
    unidade: 'Unidade Leste - RS',
    codigo: 'U005',
    telefone: '(51) 55555-5555',
    contato: 'Fernanda Lima',
    status: 'concluido',
    tempoEspera: 120,
    ultimaInteracao: {
      tipo: 'mensagem',
      texto: 'Problema resolvido, obrigada!',
      tempo: '30 min'
    }
  },
  {
    id: '6',
    unidade: 'Unidade Central - BA',
    codigo: 'U006',
    telefone: '(71) 44444-4444',
    contato: 'Roberto Silva',
    status: 'emergencia',
    tempoEspera: 60,
    ultimaInteracao: {
      tipo: 'mensagem',
      texto: 'URGENTE: Sistema fora do ar',
      tempo: '15 min'
    }
  }
];

export function useAtendimentos() {
  const [atendimentos, setAtendimentos] = useState(MOCK_ATENDIMENTOS);
  const [loading, setLoading] = useState(false);

  // TODO: Implementar busca real dos atendimentos
  useEffect(() => {
    // Simular loading
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // TODO: Implementar realtime subscriptions
  const refreshAtendimentos = () => {
    setLoading(true);
    // Simular refresh
    setTimeout(() => {
      setLoading(false);
    }, 500);
  };

  return {
    atendimentos,
    loading,
    refreshAtendimentos
  };
}