
import React from 'react';
import { Ticket } from '@/hooks/useTickets';

interface TicketDetailProps {
  ticket: Ticket;
  onClose?: () => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ ticket, onClose }) => {
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
      {onClose && (
        <div className="mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">
            Fechar
          </button>
        </div>
      )}
    </div>
  );
};

export default TicketDetail;
