import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { Crisis } from '@/hooks/useNewCrisisManagement';
import type { Ticket } from '@/hooks/useTickets';

interface CrisisGroupCardProps {
  crisis: Crisis;
  tickets: Ticket[];
  onViewCrisis: () => void;
  onSelectTicket: (ticket: Ticket) => void;
  className?: string;
}

const getStatusColor = (status: Crisis['status']) => {
  switch (status) {
    case 'aberto':
      return 'bg-destructive text-destructive-foreground';
    case 'investigando':
      return 'bg-warning text-warning-foreground';
    case 'comunicado':
      return 'bg-blue-500 text-white';
    case 'mitigado':
      return 'bg-green-500 text-white';
    case 'reaberto':
      return 'bg-destructive text-destructive-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusLabel = (status: Crisis['status']) => {
  switch (status) {
    case 'aberto': return 'Em Aberto';
    case 'investigando': return 'Investigando';
    case 'comunicado': return 'Comunicado';
    case 'mitigado': return 'Mitigado';
    case 'reaberto': return 'Reaberto';
    default: return status;
  }
};

export const CrisisGroupCard: React.FC<CrisisGroupCardProps> = ({
  crisis,
  tickets,
  onViewCrisis,
  onSelectTicket,
  className
}) => {
  const ticketCount = crisis.crise_ticket_links?.length || 0;
  const lastUpdate = crisis.crise_updates?.[0];

  return (
    <Card className={cn(
      "border-2 border-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle className="text-sm font-medium text-destructive">
                🚨 CRISE ATIVA
              </CardTitle>
              <p className="text-xs text-muted-foreground">{crisis.titulo}</p>
            </div>
          </div>
          <Badge className={getStatusColor(crisis.status)}>
            {getStatusLabel(crisis.status)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Informações da Crise */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Users className="h-3 w-3" />
            <span>{ticketCount} ticket{ticketCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNowInSaoPaulo(new Date(crisis.created_at))}</span>
          </div>
        </div>

        {/* Última Atualização */}
        {lastUpdate && (
          <div className="p-2 bg-muted/50 rounded text-xs">
            <p className="font-medium">Última atualização:</p>
            <p className="text-muted-foreground truncate">{lastUpdate.mensagem}</p>
          </div>
        )}

        {/* Tickets Envolvidos */}
        <div className="space-y-1">
          <p className="text-xs font-medium">Tickets envolvidos:</p>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {tickets.slice(0, 3).map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between p-1 bg-background/50 rounded text-xs hover:bg-background cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTicket(ticket);
                }}
              >
                <span className="truncate">{ticket.codigo_ticket}</span>
                <Badge variant="outline" className="text-xs">
                  {ticket.status}
                </Badge>
              </div>
            ))}
            {tickets.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{tickets.length - 3} ticket{tickets.length - 3 !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onViewCrisis();
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Gerenciar Crise
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};