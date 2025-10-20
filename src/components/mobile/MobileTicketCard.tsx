import { Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { Badge } from '@/components/ui/badge';

interface Ticket {
  id: string;
  codigo_ticket: string;
  titulo: string;
  status: string;
  prioridade: string;
  status_sla: string;
  data_abertura: string;
  categoria?: string;
  equipes?: {
    id: string;
    nome: string;
  };
}

interface MobileTicketCardProps {
  ticket: Ticket;
  onClick: () => void;
}

export function MobileTicketCard({ ticket, onClick }: MobileTicketCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'em_atendimento': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'aguardando_cliente': return 'bg-orange-500/10 text-orange-700 border-orange-200';
      case 'escalonado': return 'bg-red-500/10 text-red-700 border-red-200';
      case 'concluido': return 'bg-green-500/10 text-green-700 border-green-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'bg-purple-500 text-white';
      case 'imediato': return 'bg-red-500 text-white';
      case 'alto': return 'bg-orange-500 text-white';
      case 'medio': return 'bg-yellow-500 text-white';
      case 'baixo': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getPriorityIcon = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return '🔴';
      case 'imediato': return '🟠';
      case 'alto': return '🟡';
      default: return '';
    }
  };

  const statusMap: Record<string, string> = {
    'aberto': 'Aberto',
    'em_atendimento': 'Em Atendimento',
    'aguardando_cliente': 'Aguardando',
    'escalonado': 'Escalonado',
    'concluido': 'Concluído'
  };

  return (
    <div
      onClick={onClick}
      className="bg-card border rounded-lg p-4 shadow-sm active:shadow-md transition-shadow cursor-pointer"
      style={{ minHeight: '44px' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-bold text-foreground">{ticket.codigo_ticket}</span>
        <Badge 
          variant="outline" 
          className={`text-xs ${getStatusColor(ticket.status)}`}
        >
          {statusMap[ticket.status] || ticket.status}
        </Badge>
      </div>

      {/* Título */}
      <p className="text-sm text-foreground font-medium line-clamp-2 mb-2">
        {ticket.titulo}
      </p>

      {/* Info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${getPriorityColor(ticket.prioridade)}`}>
          {getPriorityIcon(ticket.prioridade)} {ticket.prioridade}
        </span>
        
        {ticket.status_sla === 'vencido' && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3 w-3" />
            SLA vencido
          </span>
        )}
        
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNowInSaoPaulo(new Date(ticket.data_abertura))}
        </span>
      </div>

      {/* Categoria */}
      {ticket.categoria && (
        <div className="mt-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {ticket.categoria}
          </span>
        </div>
      )}

      {/* Equipe Responsável */}
      {ticket.equipes && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">
            Equipe:
          </span>
          <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
            {ticket.equipes.nome}
          </span>
        </div>
      )}
    </div>
  );
}
