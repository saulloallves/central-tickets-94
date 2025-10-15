import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SearchFilters {
  search: string;
  dataInicio?: Date;
  dataFim?: Date;
  unidade_id: string;
  status: string;
  prioridade: string;
  status_sla: string;
  categoria: string;
}

interface Unidade {
  id: string;
  grupo: string;
  codigo_grupo: string;
}

export function useAdvancedTicketSearch(filters: SearchFilters, page: number, pageSize: number) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const { toast } = useToast();

  // Fetch unidades para dropdown
  useEffect(() => {
    const fetchUnidades = async () => {
      const { data, error } = await supabase
        .from('unidades')
        .select('id, grupo, codigo_grupo')
        .order('grupo');

      if (error) {
        console.error('Erro ao buscar unidades:', error);
      } else {
        setUnidades(data || []);
      }
    };

    fetchUnidades();
  }, []);

  // Fetch tickets com filtros
  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      
      let query = supabase
        .from('tickets')
        .select(`
          *,
          unidades!tickets_unidade_id_fkey(id, grupo, codigo_grupo),
          equipes!tickets_equipe_responsavel_id_fkey(id, nome),
          profiles!tickets_criado_por_fkey(id, nome, email)
        `, { count: 'exact' });

      // Filtro de busca por texto
      if (filters.search && filters.search.trim() !== '') {
        query = query.or(`
          codigo_ticket.ilike.%${filters.search}%,
          titulo.ilike.%${filters.search}%,
          descricao_problema.ilike.%${filters.search}%
        `);
      }

      // Filtro de data início
      if (filters.dataInicio) {
        const startOfDay = new Date(filters.dataInicio);
        startOfDay.setHours(0, 0, 0, 0);
        query = query.gte('data_abertura', startOfDay.toISOString());
      }

      // Filtro de data fim
      if (filters.dataFim) {
        const endOfDay = new Date(filters.dataFim);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('data_abertura', endOfDay.toISOString());
      }

      // Filtros exatos
      if (filters.unidade_id !== 'all') {
        query = query.eq('unidade_id', filters.unidade_id);
      }
      
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status as any);
      }
      
      if (filters.prioridade !== 'all') {
        query = query.eq('prioridade', filters.prioridade as any);
      }
      
      if (filters.status_sla !== 'all') {
        query = query.eq('status_sla', filters.status_sla as any);
      }

      if (filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria as any);
      }

      // Paginação
      query = query
        .order('data_abertura', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await query;
      
      if (error) {
        console.error('Erro ao buscar tickets:', error);
        toast({
          title: 'Erro ao buscar tickets',
          description: error.message,
          variant: 'destructive'
        });
        setTickets([]);
        setTotalCount(0);
      } else {
        setTickets(data || []);
        setTotalCount(count || 0);
      }
      
      setLoading(false);
    };

    fetchTickets();
  }, [filters, page, pageSize, toast]);

  return { tickets, totalCount, loading, unidades };
}
