import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, AlertTriangle, CheckCircle, Building, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTickets, type TicketFilters, type Ticket } from '@/hooks/useTickets';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TicketsKanbanProps {
  filters: TicketFilters;
  onTicketSelect: (ticketId: string) => void;
  selectedTicketId: string | null;
}

const COLUMN_STATUS = {
  aberto: 'Aberto',
  em_atendimento: 'Em Atendimento', 
  escalonado: 'Escalonado',
  concluido: 'Concluído'
};

const COLUMN_COLORS = {
  aberto: 'border-blue-200 bg-blue-50',
  em_atendimento: 'border-yellow-200 bg-yellow-50',
  escalonado: 'border-orange-200 bg-orange-50',
  concluido: 'border-green-200 bg-green-50'
};

interface KanbanTicketCardProps {
  ticket: Ticket;
  isSelected: boolean;
  onSelect: (ticketId: string) => void;
}

const KanbanTicketCard = ({ ticket, isSelected, onSelect }: KanbanTicketCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    data: {
      type: 'ticket',
      ticket,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
      case 'vencido': return <AlertTriangle className="h-3 w-3 text-destructive" />;
      case 'alerta': return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'dentro_prazo': return <CheckCircle className="h-3 w-3 text-green-500" />;
      default: return null;
    }
  };

  if (isDragging) {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        className="opacity-30 rotate-6 border-dashed"
      >
        <CardContent className="p-3">
          <div className="h-20"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-pointer transition-all hover:shadow-md mb-3",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onSelect(ticket.id)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="font-mono font-medium">
              {ticket.codigo_ticket}
            </span>
            {getSLAIcon(ticket.status_sla)}
            {ticket.reaberto_count > 0 && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                {ticket.reaberto_count}x
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <MoreVertical className="h-3 w-3" />
          </Button>
        </div>

        <h4 className="text-sm font-medium mb-2 line-clamp-2">
          {ticket.descricao_problema}
        </h4>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant={getPriorityColor(ticket.prioridade)} className="text-xs">
              {getPriorityLabel(ticket.prioridade)}
            </Badge>
            {ticket.categoria && (
              <Badge variant="secondary" className="text-xs">
                {ticket.categoria}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Building className="h-3 w-3" />
              <span>{ticket.unidade_id}</span>
            </div>
            <span>
              {formatDistanceToNowInSaoPaulo(ticket.created_at, { addSuffix: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface KanbanColumnProps {
  status: keyof typeof COLUMN_STATUS;
  tickets: Ticket[];
  selectedTicketId: string | null;
  onTicketSelect: (ticketId: string) => void;
}

const KanbanColumn = ({ status, tickets, selectedTicketId, onTicketSelect }: KanbanColumnProps) => {
  return (
    <div className={cn("rounded-lg border-2 border-dashed p-4 min-h-[600px]", COLUMN_COLORS[status])}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">{COLUMN_STATUS[status]}</h3>
        <Badge variant="secondary" className="text-xs">
          {tickets.length}
        </Badge>
      </div>
      
      <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <KanbanTicketCard
              key={ticket.id}
              ticket={ticket}
              isSelected={selectedTicketId === ticket.id}
              onSelect={onTicketSelect}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

export const TicketsKanban = ({ filters, onTicketSelect, selectedTicketId }: TicketsKanbanProps) => {
  const { tickets, loading, updateTicket } = useTickets(filters);
  const { toast } = useToast();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const ticket = active.data.current?.ticket;
    setActiveTicket(ticket);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);

    if (!over) return;

    const ticketId = active.id as string;
    const ticket = active.data.current?.ticket as Ticket;
    const newStatus = over.id as string;

    if (!newStatus || ticket.status === newStatus || !Object.keys(COLUMN_STATUS).includes(newStatus)) return;

    try {
      await updateTicket(ticketId, { status: newStatus as keyof typeof COLUMN_STATUS });
      toast({
        title: "Status atualizado",
        description: `Ticket movido para ${COLUMN_STATUS[newStatus as keyof typeof COLUMN_STATUS]}`,
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status do ticket",
        variant: "destructive",
      });
    }
  };

  const getTicketsByStatus = (status: keyof typeof COLUMN_STATUS) => {
    return tickets.filter(ticket => ticket.status === status);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {Object.keys(COLUMN_STATUS).map((status) => (
          <div key={status} className={cn("rounded-lg border-2 border-dashed p-4", COLUMN_COLORS[status as keyof typeof COLUMN_STATUS])}>
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-8 w-full mb-2" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {Object.keys(COLUMN_STATUS).map((status) => (
          <div
            key={status}
            id={status}
            data-status={status}
            style={{ minHeight: '600px' }}
            className="droppable-area"
          >
            <KanbanColumn
              status={status as keyof typeof COLUMN_STATUS}
              tickets={getTicketsByStatus(status as keyof typeof COLUMN_STATUS)}
              selectedTicketId={selectedTicketId}
              onTicketSelect={onTicketSelect}
            />
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeTicket && (
          <Card className="rotate-6">
            <CardContent className="p-3">
              <div className="text-xs font-mono mb-1">{activeTicket.codigo_ticket}</div>
              <div className="text-sm font-medium line-clamp-2">
                {activeTicket.descricao_problema}
              </div>
            </CardContent>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
};