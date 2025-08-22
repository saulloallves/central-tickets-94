
import { NewCrisisButton } from './NewCrisisButton';

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
  equipes?: { id: string; nome: string; }[];
  size?: 'sm' | 'default';
  onEdit?: () => void;
  onReply?: () => void;
}

export const TicketActions = ({ ticket, equipes, size = 'default', onEdit, onReply }: TicketActionsProps) => {

  return (
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
    </div>
  );
};
