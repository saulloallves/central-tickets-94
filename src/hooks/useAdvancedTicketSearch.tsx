import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type TicketStatus = 'aberto' | 'em_atendimento' | 'escalonado' | 'concluido';
type TicketPrioridade = 'baixo' | 'medio' | 'alto' | 'imediato' | 'crise';
type TicketSLAStatus = 'dentro_prazo' | 'alerta' | 'vencido';
type TicketCategoria = 'juridico' | 'sistema' | 'midia' | 'operacoes' | 'rh' | 'financeiro' | 'outro';

interface SearchFilters {
  search: string;
  dataInicio?: Date;
  dataFim?: Date;
  dataFinalizacaoInicio?: Date;
  dataFinalizacaoFim?: Date;
  unidade_id: string;
  status: string | 'all';
  prioridade: string | 'all';
  status_sla: string | 'all';
  categoria: string | 'all';
}

interface Unidade {
  id: string;
  grupo: string;
  codigo_grupo: string;
}

export function useAdvancedTicketSearch(filters: SearchFilters, page: number, pageSize: number, isOpen: boolean) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true); // ✅ Começa como true
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
    // ✅ Só busca quando o modal está aberto
    if (!isOpen) {
      console.log('🔍 Advanced Search - Modal fechado, pulando busca');
      return;
    }

    const fetchTickets = async () => {
      console.log('🔍 Advanced Search - Iniciando busca com filtros:', filters);
      setLoading(true);
      
      let query = supabase
        .from('tickets')
        .select(`
          *,
          unidades!tickets_unidade_id_fkey(id, grupo, codigo_grupo),
          equipes!tickets_equipe_responsavel_id_fkey(id, nome)
        `, { count: 'exact' });

      // Filtro de busca por texto
      if (filters.search && filters.search.trim() !== '') {
        const searchTerm = filters.search.trim();
        query = query.or(`codigo_ticket.ilike.%${searchTerm}%,titulo.ilike.%${searchTerm}%,descricao_problema.ilike.%${searchTerm}%`);
      }

      // Filtro de data abertura início
      if (filters.dataInicio) {
        const startOfDay = new Date(filters.dataInicio);
        startOfDay.setHours(0, 0, 0, 0);
        query = query.gte('data_abertura', startOfDay.toISOString());
      }

      // Filtro de data abertura fim
      if (filters.dataFim) {
        const endOfDay = new Date(filters.dataFim);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('data_abertura', endOfDay.toISOString());
      }

      // Filtro de data finalização início
      if (filters.dataFinalizacaoInicio) {
        const startOfDay = new Date(filters.dataFinalizacaoInicio);
        startOfDay.setHours(0, 0, 0, 0);
        query = query.gte('data_conclusao', startOfDay.toISOString());
      }

      // Filtro de data finalização fim
      if (filters.dataFinalizacaoFim) {
        const endOfDay = new Date(filters.dataFinalizacaoFim);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('data_conclusao', endOfDay.toISOString());
      }

      // Filtros exatos
      if (filters.unidade_id !== 'all') {
        query = query.eq('unidade_id', filters.unidade_id);
      }
      
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status as TicketStatus);
      }
      
      if (filters.prioridade !== 'all') {
        query = query.eq('prioridade', filters.prioridade as TicketPrioridade);
      }
      
      if (filters.status_sla !== 'all') {
        query = query.eq('status_sla', filters.status_sla as TicketSLAStatus);
      }

      if (filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria as TicketCategoria);
      }

      // Paginação
      query = query
        .order('data_abertura', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await query;
      
      console.log('🔍 Advanced Search - Resultado:', { 
        tickets: data?.length || 0, 
        total: count,
        error: error?.message 
      });
      
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
  }, [filters, page, pageSize, toast, isOpen]);

  return { tickets, totalCount, loading, unidades };
}
