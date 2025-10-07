import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Atendente {
  id: string;
  nome: string;
  tipo: string;
  status: string;
}

export function useAtendentesFilter() {
  const [atendentes, setAtendentes] = useState<Atendente[]>([]);
  const [selectedAtendenteId, setSelectedAtendenteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAtendentes();
  }, []);

  const fetchAtendentes = async () => {
    try {
      const { data, error } = await supabase
        .from('atendentes')
        .select('id, nome, tipo, status')
        .eq('ativo', true)
        .eq('status', 'ativo')
        .order('nome');

      if (error) throw error;
      setAtendentes(data || []);
    } catch (error) {
      console.error('Erro ao buscar atendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAtendimentos = (atendimentos: any[]) => {
    if (!selectedAtendenteId) return atendimentos;
    
    // Encontrar o atendente selecionado para pegar o nome
    const atendenteSelecionado = atendentes.find(a => a.id === selectedAtendenteId);
    
    return atendimentos.filter(a => {
      // Filtrar por ID quando disponível
      if (a.atendente_id === selectedAtendenteId) return true;
      
      // Fallback: filtrar por nome quando atendente_id é null (chamados legados)
      if (!a.atendente_id && atendenteSelecionado && a.atendente_nome) {
        return a.atendente_nome.toLowerCase().includes(atendenteSelecionado.nome.toLowerCase());
      }
      
      return false;
    });
  };

  return {
    atendentes,
    selectedAtendenteId,
    setSelectedAtendenteId,
    filterAtendimentos,
    loading
  };
}
