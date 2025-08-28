
import React from 'react';
import { useTickets, useTicketMessages } from '@/hooks/useTickets';

interface TicketDetailProps {
  ticketId: string;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ ticketId }) => {
  const { tickets } = useTickets({
    search: '',
    status: '',
    categoria: '',
    prioridade: '',
    unidade_id: '',
    status_sla: '',
    equipe_id: ''
  });
  const { messages, loading, sendMessage } = useTicketMessages();

  const ticket = tickets.find(t => t.id === ticketId);

  if (!ticket) {
    return <div>Ticket não encontrado</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">
        {ticket.codigo_ticket} - {ticket.titulo}
      </h2>
      <div className="space-y-4">
        <div>
          <label className="font-medium">Status:</label>
          <span className="ml-2">{ticket.status}</span>
        </div>
        <div>
          <label className="font-medium">Prioridade:</label>
          <span className="ml-2">{ticket.prioridade}</span>
        </div>
        <div>
          <label className="font-medium">Descrição:</label>
          <p className="mt-1">{ticket.descricao_problema}</p>
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;
