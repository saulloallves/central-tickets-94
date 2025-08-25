import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, User, MessageSquare, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFranqueadoUnits } from '@/hooks/useFranqueadoUnits';

interface FranqueadoTicket {
  id: string;
  codigo_ticket: string;
  titulo: string;
  descricao_problema: string;
  status: string;
  prioridade: string;
  status_sla: string;
  data_abertura: string;
  unidade_id: string;
  categoria: string;
  canal_origem: string;
  created_at: string;
  criado_por: string;
  reaberto_count: number;
}

interface FranqueadoTicketsListProps {
  onTicketSelect: (ticketId: string) => void;
  selectedTicketId: string | null;
  filters: {
    search: string;
    status: string;
    prioridade: string;
    unidade_id: string;
  };
}

export function FranqueadoTicketsList({ onTicketSelect, selectedTicketId, filters }: FranqueadoTicketsListProps) {
  const { units } = useFranqueadoUnits();
  const [tickets, setTickets] = useState<FranqueadoTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      
      try {
        let query = supabase
          .from('tickets')
          .select(`
            id,
            codigo_ticket,
            titulo,
            descricao_problema,
            status,
            prioridade,
            status_sla,
            data_abertura,
            unidade_id,
            categoria,
            canal_origem,
            created_at,
            criado_por,
            reaberto_count
          `)
          .order('data_abertura', { ascending: false });

        // Filtrar por unidades do franqueado
        const unitIds = units.map(u => u.id);
        if (unitIds.length > 0) {
          query = query.in('unidade_id', unitIds);
        }

        // Aplicar filtros
        if (filters.search) {
          query = query.or(`codigo_ticket.ilike.%${filters.search}%,titulo.ilike.%${filters.search}%,descricao_problema.ilike.%${filters.search}%`);
        }
        
        if (filters.status) {
          query = query.eq('status', filters.status as any);
        }
        
        if (filters.prioridade) {
          query = query.eq('prioridade', filters.prioridade as any);
        }
        
        if (filters.unidade_id) {
          query = query.eq('unidade_id', filters.unidade_id);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Erro ao buscar tickets:', error);
          return;
        }

        setTickets(data || []);
      } catch (error) {
        console.error('Erro ao buscar tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [units, filters]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-blue-100 text-blue-800';
      case 'em_atendimento': return 'bg-yellow-100 text-yellow-800';
      case 'aguardando_cliente': return 'bg-orange-100 text-orange-800';
      case 'escalonado': return 'bg-red-100 text-red-800';
      case 'concluido': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberto': return 'Aberto';
      case 'em_atendimento': return 'Em Atendimento';
      case 'aguardando_cliente': return 'Aguardando Cliente';
      case 'escalonado': return 'Escalonado';
      case 'concluido': return 'Concluído';
      default: return status;
    }
  };

  const getPriorityColor = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'destructive';
      case 'imediato': return 'destructive';
      case 'ate_1_hora': return 'secondary';
      case 'ainda_hoje': return 'outline';
      case 'posso_esperar': return 'outline';
      default: return 'outline';
    }
  };

  const getPriorityLabel = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'Crise';
      case 'imediato': return 'Imediato';
      case 'ate_1_hora': return 'Até 1h';
      case 'ainda_hoje': return 'Ainda hoje';
      case 'posso_esperar': return 'Posso esperar';
      default: return prioridade;
    }
  };

  const getSLAIcon = (status_sla: string) => {
    switch (status_sla) {
      case 'vencido': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'alerta': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'dentro_prazo': return <Clock className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getUnitInfo = (unidadeId: string) => {
    const unit = units.find(u => u.id === unidadeId);
    return unit ? `${unit.grupo} - ${unit.cidade}/${unit.uf}` : unidadeId;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-20 bg-muted rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Nenhum ticket encontrado</h3>
        <p className="text-muted-foreground">
          Não há tickets que correspondam aos filtros aplicados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => (
        <Card 
          key={ticket.id} 
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedTicketId === ticket.id ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => onTicketSelect(ticket.id)}
        >
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {ticket.codigo_ticket}
                  </span>
                  {getSLAIcon(ticket.status_sla)}
                  {ticket.reaberto_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Reaberto {ticket.reaberto_count}x
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(ticket.data_abertura).toLocaleString('pt-BR')}
                </div>
              </div>

              {/* Título */}
              <h4 className="font-medium line-clamp-2">
                {ticket.titulo || ticket.descricao_problema?.substring(0, 80) + '...'}
              </h4>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={getPriorityColor(ticket.prioridade)}
                  className="text-xs"
                >
                  {getPriorityLabel(ticket.prioridade)}
                </Badge>
                <Badge 
                  className={`text-xs ${getStatusColor(ticket.status)}`}
                  variant="outline"
                >
                  {getStatusLabel(ticket.status)}
                </Badge>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{getUnitInfo(ticket.unidade_id)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>via {ticket.canal_origem}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}