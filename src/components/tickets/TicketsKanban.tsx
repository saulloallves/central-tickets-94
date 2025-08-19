import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
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
  HelpCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTickets, type TicketFilters, type Ticket } from '@/hooks/useTickets';
import { TicketDetail } from './TicketDetail';
import { TicketActions } from './TicketActions';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TicketsKanbanProps {
  filters: TicketFilters;
  onTicketSelect: (ticketId: string) => void;
  selectedTicketId: string | null;
  equipes: Array<{ id: string; nome: string }>;
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
  equipes: Array<{ id: string; nome: string }>;
}

const KanbanTicketCard = ({ ticket, isSelected, onSelect, equipes }: KanbanTicketCardProps) => {
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

  const formatTimeElapsed = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (statusSla: string, prioridade: string) => {
    if (prioridade === 'crise') return 'text-critical';
    if (statusSla === 'vencido') return 'text-critical';
    if (statusSla === 'alerta') return 'text-warning';
    return 'text-success';
  };

  const getPriorityIcon = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return <AlertTriangle className="h-3 w-3 text-critical" />;
      case 'urgente': return <Clock className="h-3 w-3 text-critical" />;
      case 'alta': return <ArrowUp className="h-3 w-3 text-warning" />;
      default: return null;
    }
  };

  const getEquipeName = (equipeId: string | null) => {
    if (!equipeId) return 'Sem equipe';
    const equipe = equipes.find(e => e.id === equipeId);
    return equipe?.nome || 'Equipe desconhecida';
  };

  const getPriorityLabel = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'CRISE';
      case 'urgente': return 'Urgente';
      case 'alta': return 'Alta';
      case 'media': return 'Média';
      case 'baixa': return 'Baixa';
      default: return 'Posso esperar';
    }
  };

  const getPriorityButtonVariant = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'critical';
      case 'urgente': return 'critical';
      case 'alta': return 'warning';
      case 'media': return 'outline';
      case 'baixa': return 'outline';
      default: return 'outline';
    }
  };

  const getCategoryIcon = (categoria: string) => {
    switch (categoria) {
      case 'juridico': return <Scale className="h-3 w-3" />;
      case 'sistema': return <Monitor className="h-3 w-3" />;
      case 'midia': return <Image className="h-3 w-3" />;
      case 'operacoes': return <Settings className="h-3 w-3" />;
      case 'rh': return <Users className="h-3 w-3" />;
      case 'financeiro': return <DollarSign className="h-3 w-3" />;
      default: return <HelpCircle className="h-3 w-3" />;
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
        "cursor-pointer transition-all hover:shadow-md mb-3 bg-white",
        isSelected && "ring-2 ring-primary border-primary"
      )}
      onClick={() => onSelect(ticket.id)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with priority only */}
        <div className="flex items-end justify-end">
          <div className="flex items-center gap-1">
            {getPriorityIcon(ticket.prioridade)}
            {ticket.prioridade === 'crise' && (
              <Badge variant="critical" className="text-xs">CRISE</Badge>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-medium text-gray-900 line-clamp-2 leading-tight">
          {ticket.titulo || ticket.descricao_problema || 'Sem título'}
        </h3>

        {/* Location and Unit */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="truncate">
            {(ticket as any).unidades?.grupo || ticket.unidade_id || 'Unidade não informada'}
          </span>
        </div>

        {/* Category and Team */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="text-muted-foreground">{getCategoryIcon(ticket.categoria || 'outro')}</span>
            <span className="capitalize">
              {ticket.categoria === 'midia' ? 'Mídia' : 
               ticket.categoria === 'juridico' ? 'Jurídico' :
               ticket.categoria === 'financeiro' ? 'Financeiro' :
               ticket.categoria === 'operacoes' ? 'Operações' :
               ticket.categoria || 'Outro'}
            </span>
          </div>
          
          {ticket.equipe_responsavel_id && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-20">
                {getEquipeName(ticket.equipe_responsavel_id)}
              </span>
            </div>
          )}
        </div>

        {/* Status button and time */}
        <div className="flex items-center justify-between">
          <Button 
            variant={getPriorityButtonVariant(ticket.prioridade) as any}
            size="sm" 
            className="text-xs h-7 px-2 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            {getPriorityLabel(ticket.prioridade)}
          </Button>
          
          <div className={cn("text-xs font-mono font-semibold", getTimeColor(ticket.status_sla, ticket.prioridade))}>
            {formatTimeElapsed(ticket.created_at)}
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
  equipes: Array<{ id: string; nome: string }>;
}

const KanbanColumn = ({ status, tickets, selectedTicketId, onTicketSelect, equipes }: KanbanColumnProps) => {
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
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {tickets.length}
          </Badge>
          {tickets.length > 0 && (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" 
                 title="Atualizado em tempo real" />
          )}
        </div>
      </div>
      
      <SortableContext items={tickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <KanbanTicketCard
              key={ticket.id}
              ticket={ticket}
              isSelected={selectedTicketId === ticket.id}
              onSelect={onTicketSelect}
              equipes={equipes}
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

export const TicketsKanban = ({ filters, onTicketSelect, selectedTicketId, equipes }: TicketsKanbanProps) => {
  const { tickets, loading, updateTicket } = useTickets(filters);
  const { toast } = useToast();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // Update timestamp when tickets change
  useEffect(() => {
    setLastUpdateTime(new Date());
  }, [tickets.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
    setDraggedOverColumn(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    
    if (over && over.data.current?.type === 'column') {
      setDraggedOverColumn(over.id as string);
    } else {
      setDraggedOverColumn(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);
    setDraggedOverColumn(null);

    if (!over || over.data.current?.type !== 'column') {
      return;
    }

    const ticketId = active.id as string;
    const ticket = active.data.current?.ticket as Ticket;
    const newStatus = over.id as string;

    if (!newStatus || !ticket || ticket.status === newStatus || !Object.keys(COLUMN_STATUS).includes(newStatus)) {
      return;
    }

    try {
      // Ensure we only update the status field
      const result = await updateTicket(ticketId, { 
        status: newStatus as keyof typeof COLUMN_STATUS
      });
      
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
      onDragOver={handleDragOver}
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
            equipes={equipes}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTicket && (
          <Card className="rotate-3 shadow-2xl scale-105 transition-all duration-200 border-primary">
            <CardContent className="p-3">
              <div className="text-xs font-mono mb-1 text-muted-foreground">
                {activeTicket.codigo_ticket}
              </div>
              <div className="text-sm font-medium line-clamp-2 mb-2">
                {activeTicket.titulo || (activeTicket.descricao_problema?.length > 60 
                  ? activeTicket.descricao_problema.substring(0, 60) + '...'
                  : activeTicket.descricao_problema || 'Sem título')}
              </div>
              <Badge variant="outline" className="text-xs">
                {COLUMN_STATUS[activeTicket.status]}
              </Badge>
              {draggedOverColumn && draggedOverColumn !== activeTicket.status && (
                <div className="mt-2 text-xs text-primary font-medium">
                  → {COLUMN_STATUS[draggedOverColumn as keyof typeof COLUMN_STATUS]}
                </div>
              )}
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