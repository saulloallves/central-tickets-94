import { useState, useEffect } from 'react';
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
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  MapPin, 
  Users, 
  ArrowUp,
  Scale,
  Monitor,
  Image,
  Settings,
  DollarSign,
  HelpCircle,
  Edit2,
  Trash2,
  GripVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Ticket } from '@/hooks/useTickets';
import { TicketDetail } from './TicketDetail';
import { TicketActions } from './TicketActions';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface TicketsKanbanProps {
  tickets: Ticket[];
  loading: boolean;
  onTicketSelect: (ticketId: string) => void;
  onUpdateTicketStatus: (ticketId: string, newStatus: string) => Promise<boolean>;
  selectedTicketId: string | null;
  equipes: Array<{ id: string; nome: string; ativo: boolean }>;
}

const COLUMN_STATUS = {
  aberto: 'Aberto',
  em_atendimento: 'Em Atendimento', 
  escalonado: 'Escalonado',
  concluido: 'Concluído'
};

const COLUMN_COLORS = {
  aberto: 'border-blue-200 bg-blue-50',
  em_atendimento: 'border-orange-200 bg-orange-50',
  escalonado: 'border-red-200 bg-red-50',
  concluido: 'border-green-200 bg-green-50'
};

// Kanban Card Component
interface KanbanTicketCardProps {
  ticket: Ticket;
  onSelect: (ticketId: string) => void;
  isDragging?: boolean;
}

const KanbanTicketCard = ({ ticket, onSelect, isDragging = false }: KanbanTicketCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggingFromHook,
  } = useSortable({
    id: ticket.id,
    data: {
      id: ticket.id,
      status: ticket.status,
    },
  });

  const isCurrentlyDragging = isDragging || isDraggingFromHook;

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  const getPriorityIcon = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return ArrowUp;
      case 'urgente': return AlertTriangle;
      case 'alta': return ArrowUp;
      default: return Clock;
    }
  };

  const getPriorityColor = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'destructive';
      case 'urgente': return 'destructive';
      case 'alta': return 'orange';
      default: return 'secondary';
    }
  };

  const getCategoryIcon = (categoria?: string) => {
    switch (categoria) {
      case 'juridico': return Scale;
      case 'sistema': return Monitor;
      case 'midia': return Image;
      case 'operacoes': return Settings;
      case 'rh': return Users;
      case 'financeiro': return DollarSign;
      default: return HelpCircle;
    }
  };

  const formatTimeElapsed = (dataAbertura: string) => {
    try {
      return formatDistanceToNowInSaoPaulo(new Date(dataAbertura));
    } catch {
      return 'Data inválida';
    }
  };

  const PriorityIcon = getPriorityIcon(ticket.prioridade);
  const CategoryIcon = getCategoryIcon(ticket.categoria);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isCurrentlyDragging && "opacity-50 rotate-3 scale-105 shadow-xl z-50"
      )}
      onClick={(e) => {
        if (!isCurrentlyDragging) {
          onSelect(ticket.id);
        }
      }}
    >
      <CardContent className="p-3 space-y-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-between p-1 rounded cursor-grab active:cursor-grabbing hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-3 h-3 text-muted-foreground" />
            <Badge variant="outline" className="text-xs">
              {ticket.codigo_ticket}
            </Badge>
          </div>
          <Badge variant={getPriorityColor(ticket.prioridade) as any} className="text-xs">
            <PriorityIcon className="w-3 h-3 mr-1" />
            {ticket.prioridade}
          </Badge>
        </div>

        {/* Title/Description */}
        <div className="space-y-1">
          {ticket.titulo && (
            <h4 className="font-medium text-sm line-clamp-2">{ticket.titulo}</h4>
          )}
          <p className="text-xs text-muted-foreground line-clamp-2">
            {ticket.descricao_problema}
          </p>
        </div>

        {/* Unit and Category */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{ticket.unidade_id}</span>
          </div>
          {ticket.categoria && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <CategoryIcon className="w-3 h-3" />
              <span className="capitalize">{ticket.categoria}</span>
            </div>
          )}
        </div>

        {/* Time elapsed and SLA status */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {formatTimeElapsed(ticket.data_abertura)}
          </span>
          <Badge 
            variant={ticket.status_sla === 'vencido' ? 'destructive' : 
                    ticket.status_sla === 'alerta' ? 'outline' : 'secondary'} 
            className="text-xs"
          >
            {ticket.status_sla === 'vencido' ? 'SLA Vencido' :
             ticket.status_sla === 'alerta' ? 'SLA Alerta' : 'SLA OK'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

// Kanban Column Component
interface KanbanColumnProps {
  status: string;
  title: string;
  tickets: Ticket[];
  onTicketSelect: (ticketId: string) => void;
}

const KanbanColumn = ({ status, title, tickets, onTicketSelect }: KanbanColumnProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl p-4 transition-all duration-200",
        COLUMN_COLORS[status as keyof typeof COLUMN_COLORS],
        isOver && "ring-2 ring-primary ring-opacity-50 scale-[1.02]"
      )}
    >
      {/* Column Header */}
      <div className="sticky top-0 bg-background/80 backdrop-blur z-10 flex items-center justify-between p-2 mb-4 rounded-lg">
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge 
          variant="secondary" 
          className={cn(
            "text-xs",
            isOver && "bg-primary text-primary-foreground"
          )}
        >
          {tickets.length}
        </Badge>
      </div>

      {/* Drop Zone Overlay */}
      {isOver && (
        <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-xl pointer-events-none z-10 flex items-center justify-center">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium">
            Soltar aqui para {title.toLowerCase()}
          </div>
        </div>
      )}

      {/* Tickets */}
      <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
        {tickets.map((ticket) => (
          <KanbanTicketCard
            key={ticket.id}
            ticket={ticket}
            onSelect={onTicketSelect}
          />
        ))}
        
        {tickets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum ticket
          </div>
        )}
      </div>
    </div>
  );
};

// Main Kanban Component
export const TicketsKanban = ({ 
  tickets,
  loading,
  onTicketSelect, 
  onUpdateTicketStatus,
  selectedTicketId, 
  equipes 
}: TicketsKanbanProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<Ticket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getTicketsByStatus = (status: string) => {
    return tickets.filter(ticket => ticket.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    console.log('🎯 Drag started:', event.active.id);
    setActiveId(String(event.active.id));
    const ticket = tickets.find(t => t.id === event.active.id);
    setDraggedItem(ticket || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setDraggedItem(null);

    if (!over) {
      console.log('⚠️ No drop target');
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const fromStatus = (active.data.current as any)?.status;
    const toStatus = overId;

    console.log('🎯 Drag ended:', { activeId, overId, fromStatus, toStatus });

    if (fromStatus === toStatus) {
      console.log('⚠️ Same status, ignoring');
      return;
    }

    try {
      const success = await onUpdateTicketStatus(activeId, toStatus);
      console.log('📊 Status update result:', success);
    } catch (error) {
      console.error('❌ Error updating status:', error);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-24 w-full" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const columns = [
    { status: 'aberto', title: 'Aberto' },
    { status: 'em_atendimento', title: 'Em Atendimento' },
    { status: 'escalonado', title: 'Escalonado' },
    { status: 'concluido', title: 'Concluído' },
  ];

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              title={column.title}
              tickets={getTicketsByStatus(column.status)}
              onTicketSelect={onTicketSelect}
            />
          ))}
        </div>

        <DragOverlay>
          {draggedItem ? (
            <KanbanTicketCard
              ticket={draggedItem}
              onSelect={() => {}}
              isDragging={true}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicketId} onOpenChange={() => onTicketSelect('')}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Ticket</DialogTitle>
          </DialogHeader>
          {selectedTicketId && (
            <TicketDetail 
              ticketId={selectedTicketId}
              onClose={() => onTicketSelect('')}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};