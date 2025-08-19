
import { Clock, AlertTriangle, CheckCircle, User, Building } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTickets, type TicketFilters } from '@/hooks/useTickets';
import { TicketActions } from './TicketActions';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TicketsListProps {
  filters: TicketFilters;
  onTicketSelect: (ticketId: string) => void;
  selectedTicketId: string | null;
}

export const TicketsList = ({ filters, onTicketSelect, selectedTicketId }: TicketsListProps) => {
  const { tickets, loading } = useTickets(filters);
  const [equipes, setEquipes] = useState<Array<{ id: string; nome: string }>>([]);

  // Fetch equipes for the action buttons
  useEffect(() => {
    const fetchEquipes = async () => {
      try {
        const { data, error } = await supabase
          .from('equipes')
          .select('id, nome')
          .eq('ativo', true)
          .order('nome');

        if (!error && data) {
          setEquipes(data);
        }
      } catch (error) {
        console.error('Error fetching equipes:', error);
      }
    };

    fetchEquipes();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-blue-500';
      case 'em_atendimento': return 'bg-yellow-500';
      case 'escalonado': return 'bg-orange-500';
      case 'concluido': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberto': return 'Aberto';
      case 'em_atendimento': return 'Em Atendimento';
      case 'escalonado': return 'Escalonado';
      case 'concluido': return 'Concluído';
      default: return status;
    }
  };

  const getPriorityColor = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'destructive';
      case 'urgente': return 'destructive';
      case 'alta': return 'outline';
      case 'hoje_18h': return 'secondary';
      case 'padrao_24h': return 'secondary';
      default: return 'secondary';
    }
  };

  const getPriorityLabel = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'Crise';
      case 'urgente': return 'Urgente';
      case 'alta': return 'Alta';
      case 'hoje_18h': return 'Hoje 18h';
      case 'padrao_24h': return 'Padrão';
      default: return prioridade;
    }
  };

  const getSLAIcon = (status_sla: string) => {
    switch (status_sla) {
      case 'vencido': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'alerta': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'dentro_prazo': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const getTicketDisplayTitle = (ticket: any) => {
    if (ticket.titulo) {
      return ticket.titulo;
    }
    // Fallback: primeiro 50 chars da descrição
    return ticket.descricao_problema.length > 50 
      ? ticket.descricao_problema.substring(0, 50) + '...'
      : ticket.descricao_problema;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-full mb-2" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <p>Nenhum ticket encontrado com os filtros aplicados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <Card 
          key={ticket.id}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            selectedTicketId === ticket.id && "ring-2 ring-primary"
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1 flex-1" onClick={() => onTicketSelect(ticket.id)}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {ticket.codigo_ticket}
                  </span>
                  {getSLAIcon(ticket.status_sla)}
                  {ticket.reaberto_count > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Reaberto {ticket.reaberto_count}x
                    </Badge>
                  )}
                </div>
                <h3 className="font-medium text-sm line-clamp-2">
                  {getTicketDisplayTitle(ticket)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNowInSaoPaulo(ticket.created_at, { addSuffix: true })}
                </p>
              </div>
              
              <div className="flex flex-col items-end gap-2 ml-4">
                <div className="flex gap-2">
                  <Badge variant={getPriorityColor(ticket.prioridade)}>
                    {getPriorityLabel(ticket.prioridade)}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <div className={cn("w-2 h-2 rounded-full", getStatusColor(ticket.status))} />
                    <span className="text-xs">{getStatusLabel(ticket.status)}</span>
                  </div>
                </div>
                
                <TicketActions ticket={ticket} equipes={equipes} size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground" onClick={() => onTicketSelect(ticket.id)}>
              <div className="flex items-center gap-4">
                {ticket.equipes?.nome && (
                  <Badge variant="secondary" className="text-xs">
                    {ticket.equipes.nome}
                  </Badge>
                )}
                
                <div className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  <span>{ticket.unidade_id}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <span className="capitalize">{ticket.canal_origem}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
