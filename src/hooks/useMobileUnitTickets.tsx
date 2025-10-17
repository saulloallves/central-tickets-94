import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface Ticket {
  id: string;
  codigo_ticket: string;
  titulo: string;
  descricao_problema: string;
  status: string;
  prioridade: string;
  status_sla: string;
  data_abertura: string;
  data_limite_sla: string;
  unidade_id: string;
  categoria: string;
  equipes?: {
    id: string;
    nome: string;
  };
}

interface Unidade {
  id: string;
  grupo: string;
  codigo_grupo: string;
  cidade: string;
  uf: string;
}

export const useMobileUnitTickets = () => {
  const [searchParams] = useSearchParams();
  const codigoGrupo = searchParams.get('codigo_grupo');
  const senhaWeb = searchParams.get('senha_web');
  
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    if (!codigoGrupo) {
      setError('Código do grupo não fornecido na URL');
      setLoading(false);
      return;
    }

    try {
      // Buscar unidade pelo codigo_grupo
      const { data: unidadeData, error: unidadeError } = await supabase
        .from('unidades')
        .select('id, grupo, codigo_grupo, cidade, uf')
        .eq('codigo_grupo', codigoGrupo)
        .maybeSingle();

      if (unidadeError) throw unidadeError;
      
      if (!unidadeData) {
        setError('Unidade não encontrada para este código');
        setLoading(false);
        return;
      }

      setUnidade(unidadeData);

      // Buscar tickets da unidade
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          *,
          equipes!tickets_equipe_responsavel_id_fkey(id, nome)
        `)
        .eq('unidade_id', unidadeData.id)
        .order('data_abertura', { ascending: false });

      if (ticketsError) throw ticketsError;

      setTickets((ticketsData || []) as Ticket[]);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [codigoGrupo]);

  // Setup realtime para tickets
  const setupRealtime = useCallback(() => {
    if (!unidade?.id) return;

    console.log('🔄 Configurando realtime para unidade:', unidade.id);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`mobile-unit-tickets-${unidade.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `unidade_id=eq.${unidade.id}`
        },
        (payload) => {
          console.log('📡 Ticket change:', payload.eventType);
          fetchData();
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [unidade?.id, fetchData]);

  useEffect(() => {
    fetchData().then(() => {
      setupRealtime();
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchData, setupRealtime]);

  const ticketsAbertos = tickets.filter(t => t.status !== 'concluido');
  const ticketsFechados = tickets.filter(t => t.status === 'concluido');

  return {
    unidade,
    tickets,
    ticketsAbertos,
    ticketsFechados,
    loading,
    error,
    refetch: fetchData,
    codigoGrupo,
    senhaWeb
  };
};
