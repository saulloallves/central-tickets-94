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
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTickets, type TicketFilters, type Ticket } from '@/hooks/useTickets';
import { TicketDetail } from './TicketDetail';
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
      default: return 'secondary';
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
          <div className="h-16"></div>
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
            {getSLAIcon(ticket.status_sla)}
          </div>
          <Badge variant={getPriorityColor(ticket.prioridade)} className="text-xs">
            {ticket.prioridade === 'padrao_24h' ? 'Padrão' : ticket.prioridade}
          </Badge>
        </div>

        <h4 className="text-sm font-medium mb-2 line-clamp-2">
          {ticket.descricao_problema}
        </h4>

        <div className="text-xs text-muted-foreground">
          {formatDistanceToNowInSaoPaulo(ticket.created_at, { addSuffix: true })}
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
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'column',
      status: status
    }
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "rounded-lg border-2 border-dashed p-4 min-h-[600px] transition-colors",
        COLUMN_COLORS[status],
        isOver && "bg-opacity-30 border-solid"
      )}
    >
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
          {tickets.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Nenhum ticket nesta coluna
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export const TicketsKanban = ({ filters, onTicketSelect, selectedTicketId }: TicketsKanbanProps) => {
  const { tickets, loading, updateTicket } = useTickets(filters);
  const { toast } = useToast();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const handleTicketClick = (ticketId: string) => {
    onTicketSelect(ticketId);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    onTicketSelect('');
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const ticket = active.data.current?.ticket;
    setActiveTicket(ticket);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);

    console.log('Drag end event:', { active: active.id, over: over?.id });

    if (!over) {
      console.log('No drop target');
      return;
    }

    const ticketId = active.id as string;
    const ticket = active.data.current?.ticket as Ticket;
    const newStatus = over.id as string;

    console.log('Drag details:', { 
      ticketId, 
      currentStatus: ticket?.status, 
      newStatus, 
      validStatuses: Object.keys(COLUMN_STATUS) 
    });

    if (!newStatus || !ticket || ticket.status === newStatus || !Object.keys(COLUMN_STATUS).includes(newStatus)) {
      console.log('Skipping update - invalid move');
      return;
    }

    try {
      console.log('Updating ticket status...');
      const result = await updateTicket(ticketId, { status: newStatus as keyof typeof COLUMN_STATUS });
      console.log('Update result:', result);
      
      if (result) {
        toast({
          title: "Status atualizado",
          description: `Ticket movido para ${COLUMN_STATUS[newStatus as keyof typeof COLUMN_STATUS]}`,
        });
      }
    } catch (error) {
      console.error('Error updating ticket:', error);
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
          <KanbanColumn
            key={status}
            status={status as keyof typeof COLUMN_STATUS}
            tickets={getTicketsByStatus(status as keyof typeof COLUMN_STATUS)}
            selectedTicketId={selectedTicketId}
            onTicketSelect={handleTicketClick}
          />
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

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Ticket</DialogTitle>
          </DialogHeader>
          {selectedTicketId && (
            <TicketDetail 
              ticketId={selectedTicketId}
              onClose={closeDetailModal}
            />
          )}
        </DialogContent>
      </Dialog>
    </DndContext>
  );
};