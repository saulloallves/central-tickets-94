
import { Edit, MessageSquare, Clock, User, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NewCrisisButton } from './NewCrisisButton';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';

interface TicketActionsProps {
  ticket: {
    id: string;
    codigo_ticket: string;
    prioridade: string;
    status: string;
    data_abertura: string;
    data_limite_sla?: string;
    status_sla: string;
    unidade_id: string;
    categoria?: string;
    unidades?: {
      grupo: string;
    };
  };
  onEdit: () => void;
  onReply: () => void;
}

export const TicketActions = ({ ticket, onEdit, onReply }: TicketActionsProps) => {
  const getSLAColor = (status: string) => {
    switch (status) {
      case 'vencido': return 'text-red-600 bg-red-50';
      case 'alerta': return 'text-orange-600 bg-orange-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  const getSLALabel = (status: string) => {
    switch (status) {
      case 'vencido': return 'SLA Vencido';
      case 'alerta': return 'SLA Alerta';
      default: return 'SLA OK';
    }
  };

  return (
    <div className="flex items-center justify-between pt-3 border-t">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-xs ${getSLAColor(ticket.status_sla)}`}>
          <Clock className="h-3 w-3 mr-1" />
          {getSLALabel(ticket.status_sla)}
        </Badge>
        
        {ticket.data_limite_sla && (
          <span className="text-xs text-muted-foreground">
            Vence {formatDistanceToNowInSaoPaulo(ticket.data_limite_sla)}
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        <NewCrisisButton 
          ticketId={ticket.id}
          currentPriority={ticket.prioridade}
          ticketInfo={{
            codigo_ticket: ticket.codigo_ticket,
            unidade: ticket.unidades?.grupo,
            categoria: ticket.categoria
          }}
        />
        
        <Button variant="ghost" size="sm" onClick={onReply}>
          <MessageSquare className="h-3 w-3" />
        </Button>
        
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
