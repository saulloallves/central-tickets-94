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
  HelpCircle,
  Edit2,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTickets, type TicketFilters, type Ticket } from '@/hooks/useTickets';
import { useSimpleTicketDragDrop } from '@/hooks/useSimpleTicketDragDrop';
import { TicketDetail } from './TicketDetail';
import { TicketActions } from './TicketActions';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface TicketsKanbanProps {
  tickets: Ticket[];
  loading: boolean;
  onTicketSelect: (ticketId: string) => void;
  selectedTicketId: string | null;
  equipes: Array<{ id: string; nome: string }>;
  onChangeStatus: (
    ticketId: string, 
    fromStatus: string, 
    toStatus: string,
    beforeId?: string,
    afterId?: string
  ) => Promise<boolean>;
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
      case 'crise': return <AlertTriangle className="h-2 w-2 text-critical" />;
      case 'urgente': return <Clock className="h-2 w-2 text-critical" />;
      case 'alta': return <ArrowUp className="h-2 w-2 text-warning" />;
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
      case 'juridico': return <Scale className="h-2 w-2" />;
      case 'sistema': return <Monitor className="h-2 w-2" />;
      case 'midia': return <Image className="h-2 w-2" />;
      case 'operacoes': return <Settings className="h-2 w-2" />;
      case 'rh': return <Users className="h-2 w-2" />;
      case 'financeiro': return <DollarSign className="h-2 w-2" />;
      default: return <HelpCircle className="h-2 w-2" />;
    }
  };

  if (isDragging) {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        className="opacity-50 border-2 border-primary border-dashed bg-primary/5 transform rotate-2 shadow-xl scale-105"
      >
        <CardContent className="p-3">
          <div className="h-16 flex items-center justify-center">
            <span className="text-xs text-primary font-medium">Arrastando...</span>
          </div>
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
        "cursor-pointer transition-all hover:shadow-lg mb-3 bg-white border-l-4",
        ticket.status === 'concluido' ? "border-l-success" : 
        ticket.prioridade === 'crise' ? "border-l-critical" :
        ticket.prioridade === 'urgente' ? "border-l-critical" :
        ticket.prioridade === 'alta' ? "border-l-warning" : "border-l-muted",
        isSelected && "ring-2 ring-primary/20 shadow-lg"
      )}
      onClick={() => onSelect(ticket.id)}
    >
      <CardContent className="p-3 space-y-2">
        {/* Título */}
        <h3 className="font-medium text-sm text-foreground line-clamp-1 leading-tight">
          {(() => {
            const title = ticket.titulo || ticket.descricao_problema || "Sem título";
            const words = title.trim().split(/\s+/);
            return words.length > 3 ? words.slice(0, 3).join(' ') : title;
          })()}
        </h3>

        {/* Metadados em linha */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {/* Localização */}
          <div className="flex items-center gap-1 min-w-0 flex-1 bg-muted/50 px-2 py-1 rounded">
            <MapPin className="h-3 w-3 flex-shrink-0 text-primary" />
            <span className="truncate text-xs font-medium">
              {(() => {
                const unidade = (ticket as any).unidades;
                
                if (unidade?.cidade && unidade?.uf && unidade.cidade !== '-' && unidade.uf !== '-') {
                  return `${unidade.cidade} - ${unidade.uf}`;
                }
                if (unidade?.grupo) {
                  return unidade.grupo;
                }
                return ticket.unidade_id || 'Sem unidade';
              })()}
            </span>
          </div>
          
          {/* Categoria */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {getCategoryIcon(ticket.categoria || 'outro')}
          </div>
        </div>

        {/* Footer com status */}
        {ticket.status === 'concluido' ? (
          <div className="flex items-center justify-between pt-2 border-t border-muted/50">
            <Badge variant="success" className="text-xs">
              Resolvido
            </Badge>
            <div className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="h-2 w-2" />
              <span>{formatDistanceToNowInSaoPaulo(new Date(ticket.updated_at || ticket.created_at))}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2 border-t border-muted/50">
            <Badge 
              variant={getPriorityButtonVariant(ticket.prioridade) as any}
              className="text-xs"
            >
              {getPriorityLabel(ticket.prioridade)}
            </Badge>
            
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className={cn("text-xs font-mono", getTimeColor(ticket.status_sla, ticket.prioridade))}>
                {formatTimeElapsed(ticket.created_at)}
              </span>
            </div>
          </div>
        )}
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
        "flex flex-col h-full min-h-[600px] rounded-lg border-2 transition-all duration-200",
        COLUMN_COLORS[status],
        isOver ? "border-primary bg-primary/10 border-solid scale-[1.02] shadow-lg" : "border-dashed"
      )}
    >
      {/* Header da coluna */}
      <div className="flex items-center justify-between p-4 pb-2">
        <h3 className="font-semibold text-sm">{COLUMN_STATUS[status]}</h3>
        <Badge variant="secondary" className="text-xs">
          {tickets.length}
        </Badge>
      </div>
      
      {/* Área de conteúdo - também droppable */}
      <div className="flex-1 p-4 pt-2">
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
    </div>
  );
};

export const TicketsKanban = ({ tickets, loading, onTicketSelect, selectedTicketId, equipes, onChangeStatus }: TicketsKanbanProps) => {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  // Update timestamp when tickets change
  useEffect(() => {
    console.log('📊 Tickets updated, count:', tickets.length);
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

    console.log('🎯 Drag end event:', {
      over: over?.id,
      overData: over?.data?.current,
      activeId: active.id,
      activeData: active.data?.current
    });

    if (!over) {
      console.log('❌ No drop target');
      return;
    }

    const ticketId = active.id as string;
    const ticket = active.data.current?.ticket as Ticket;
    
    if (!ticket) {
      console.log('❌ No ticket data found');
      return;
    }

    // Get the target status - check column first, then ticket
    let newStatus: string;
    
    // Priority 1: Direct column drop (improved detection)
    const validStatuses = ['aberto', 'em_atendimento', 'escalonado', 'concluido'];
    const overId = over.id as string;
    
    if (validStatuses.includes(overId)) {
      newStatus = overId;
      console.log('✅ Dropped on column:', newStatus);
    }
    // Priority 2: Dropped on a ticket in a column
    else if (over.data?.current?.ticket) {
      const targetTicket = over.data.current.ticket as Ticket;
      newStatus = targetTicket.status;
      console.log('✅ Dropped on ticket, using its status:', newStatus);
    }
    // Priority 3: Try to find which column contains this item
    else {
      console.log('🔍 Attempting to determine column from ticket list...');
      const overTicket = tickets.find(t => t.id === over.id);
      if (overTicket) {
        newStatus = overTicket.status;
        console.log('✅ Found ticket in column:', newStatus);
      } else {
        console.log('❌ Could not determine target status');
        console.log('📋 Available statuses:', validStatuses);
        console.log('📋 Drop target ID:', overId);
        return;
      }
    }

    if (ticket.status === newStatus) {
      console.log('❌ Same status - no change needed');
      return;
    }

    console.log('🎯 Starting drag-drop update:', {
      ticketId,
      ticketCode: ticket.codigo_ticket,
      from: ticket.status,
      to: newStatus
    });

    // Enhanced move with position support
    const success = await onChangeStatus(
      ticketId, 
      ticket.status, 
      newStatus,
      undefined, // beforeId - to be implemented with sortable ordering
      undefined  // afterId - to be implemented with sortable ordering
    );
    
    if (success) {
      console.log('✅ Drag-drop completed successfully');
    } else {
      console.log('❌ Drag-drop failed');
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