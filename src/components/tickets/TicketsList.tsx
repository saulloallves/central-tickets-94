
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Ticket } from '@/hooks/useTickets';

interface TicketsListProps {
  tickets: Ticket[];
  loading: boolean;
  onTicketSelect: (ticketId: string) => void;
  selectedTicketId: string | null;
  showFilters: boolean;
  onToggleFilters: () => void;
}

const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case 'crise': return 'critical';
    case 'imediato': return 'destructive';
    case 'ate_1_hora': return 'warning';
    case 'ainda_hoje': return 'info';
    case 'posso_esperar': return 'success';
    default: return 'default';
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'crise': return 'Crise';
    case 'imediato': return 'Imediato';
    case 'ate_1_hora': return 'Em 1h';
    case 'ainda_hoje': return 'Hoje';
    case 'posso_esperar': return 'Aguardar';
    default: return 'Normal';
  }
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'aberto': return 'secondary';
    case 'em_atendimento': return 'info';
    case 'escalonado': return 'warning';
    case 'concluido': return 'success';
    default: return 'default';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'aberto': return 'Aberto';
    case 'em_atendimento': return 'Em Atendimento';
    case 'escalonado': return 'Escalonado';
    case 'concluido': return 'Concluído';
    default: return 'Desconhecido';
  }
};

export const TicketsList: React.FC<TicketsListProps> = ({
  tickets,
  loading,
  onTicketSelect,
  selectedTicketId,
  showFilters,
  onToggleFilters,
}) => {
  const filteredTickets = tickets || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {loading ? (
        <div className="col-span-full text-center">Carregando tickets...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="col-span-full text-center">Nenhum ticket encontrado.</div>
      ) : (
          filteredTickets.map((ticket) => (
            <Card
              key={ticket.id}
              className={cn(
                "p-4 cursor-pointer transition-all duration-200 hover:shadow-card hover:-translate-y-1",
                ticket.id === selectedTicketId && "ring-2 ring-primary"
              )}
              onClick={() => onTicketSelect(ticket.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={getPriorityVariant(ticket.prioridade)}
                    className="text-xs"
                  >
                    {getPriorityLabel(ticket.prioridade)}
                  </Badge>
                  <Badge 
                    variant={getStatusVariant(ticket.status)}
                    className="text-xs"
                  >
                    {getStatusLabel(ticket.status)}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {ticket.unidades?.grupo || 'N/A'}
                </span>
              </div>
              
              <h3 className="font-semibold mb-1 text-sm line-clamp-1">
                {ticket.codigo_ticket} - {ticket.titulo || 'Sem título'}
              </h3>
              
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {ticket.descricao_problema || 'Sem descrição'}
              </p>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>
                    {ticket.colaboradores?.nome_completo || 'Sistema'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {ticket.canal_origem && (
                    <Badge variant="outline" className="text-xs">
                      {ticket.canal_origem}
                    </Badge>
                  )}
                  <Badge 
                    variant={ticket.status_sla === 'vencido' ? 'destructive' : ticket.status_sla === 'alerta' ? 'warning' : 'success'}
                    className="text-xs"
                  >
                    SLA {ticket.status_sla || 'dentro_prazo'}
                  </Badge>
                </div>
              </div>
            </Card>
          ))
      )}
    </div>
  );
};
