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
  Trash2,
  GripVertical,
  Filter,
  Circle,
  PlayCircle,
  AlertCircle,
  CheckCircle2
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
import { useNewCrisisManagement } from '@/hooks/useNewCrisisManagement';
import { formatDistanceToNowInSaoPaulo, calculateTimeRemaining, isFromPreviousBusinessDay } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface TicketsKanbanProps {
  tickets: Ticket[];
  loading: boolean;
  onTicketSelect: (ticketId: string) => void;
  selectedTicketId: string | null;
  equipes: Array<{ id: string; nome: string }>;
  showFilters?: boolean;
  onToggleFilters?: () => void;
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

const COLUMN_ICONS = {
  aberto: Circle,
  em_atendimento: PlayCircle,
  escalonado: AlertCircle,
  concluido: CheckCircle2
};

const COLUMN_ICON_COLORS = {
  aberto: 'text-blue-500',
  em_atendimento: 'text-orange-500',
  escalonado: 'text-red-500',
  concluido: 'text-green-500'
};

const COLUMN_COLORS = {
  aberto: 'border-gray-300/50 bg-gray-100/80',
  em_atendimento: 'border-gray-300/50 bg-gray-100/80',
  escalonado: 'border-gray-300/50 bg-gray-100/80',
  concluido: 'border-gray-300/50 bg-gray-100/80'
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


  const getTimeColor = (statusSla: string, prioridade: string) => {
    if (prioridade === 'crise') return 'text-critical';
    if (statusSla === 'vencido') return 'text-critical';
    if (statusSla === 'alerta') return 'text-warning';
    return 'text-success';
  };

  const getPriorityIcon = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return <AlertTriangle className="h-2 w-2 text-critical" />;
      case 'imediato': return <Clock className="h-2 w-2 text-critical" />;
      case 'ate_1_hora': return <ArrowUp className="h-2 w-2 text-warning" />;
      case 'ainda_hoje': return <ArrowUp className="h-2 w-2 text-warning" />;
      case 'posso_esperar': return null;
      default: return null;
    }
  };

  const getEquipeName = (equipeId: string | null) => {
    if (!equipeId) return 'Sem equipe';
    const equipe = equipes.find(e => e.id === equipeId);
    return equipe?.nome || 'Equipe desconhecida';
  };

  const getEquipeColor = (equipeName: string) => {
    const colors = [
      { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
      { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', border: 'border-green-200' },
      { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', border: 'border-purple-200' },
      { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
      { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500', border: 'border-pink-200' },
      { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-indigo-200' },
      { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', border: 'border-teal-200' },
      { bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500', border: 'border-cyan-200' },
    ];
    
    // Generate a consistent color based on team name
    const hash = equipeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getPriorityLabel = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'CRISE';
      case 'imediato': return 'Imediato';
      case 'ate_1_hora': return 'Até 1h';
      case 'ainda_hoje': return 'Ainda Hoje';
      case 'posso_esperar': return 'Posso Esperar';
      default: return 'Posso esperar';
    }
  };

  const getPriorityButtonVariant = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'critical';
      case 'imediato': return 'critical';
      case 'ate_1_hora': return 'warning';
      case 'ainda_hoje': return 'outline';
      case 'posso_esperar': return 'outline';
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
        "cursor-grab active:cursor-grabbing transition-all duration-200 mb-3 bg-gradient-to-br from-white to-gray-50/50 border border-gray-200/60 shadow-sm hover:shadow-md select-none overflow-hidden group",
        ticket.status === 'concluido' ? "border-l-4 border-l-emerald-400" : 
        ticket.prioridade === 'crise' ? "border-l-4 border-l-red-500" :
        ticket.prioridade === 'imediato' ? "border-l-4 border-l-red-500" :
        ticket.prioridade === 'ate_1_hora' ? "border-l-4 border-l-orange-500" :
        ticket.prioridade === 'ainda_hoje' ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-slate-300",
        isSelected && "ring-2 ring-blue-500/20 shadow-lg",
        isDragging && "opacity-70 scale-95 z-50 shadow-xl rotate-1"
      )}
      onClick={(e) => {
        if (!isDragging) {
          onSelect(ticket.id);
        }
      }}
    >
      <CardContent className="p-4 space-y-3 pointer-events-none">
        {/* Título - Maior e mais destaque */}
        <h3 className="font-medium text-gray-800 text-base line-clamp-2 leading-tight group-hover:text-gray-600 transition-colors">
          {(() => {
            const title = ticket.titulo || ticket.descricao_problema || "Sem título";
            const words = title.trim().split(/\s+/);
            return words.length > 4 ? words.slice(0, 4).join(' ') + '...' : title;
          })()}
        </h3>

        {/* Equipe e Prioridade - Menores */}
        <div className="flex items-center justify-between">
          {/* Equipe Responsável - Menor */}
          {ticket.equipes?.nome && (() => {
            const colors = getEquipeColor(ticket.equipes.nome);
            return (
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-all",
                colors.bg, colors.border, "border"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full", colors.dot)}></div>
                <span className={cn("text-xs font-medium truncate max-w-20", colors.text)}>
                  {ticket.equipes.nome}
                </span>
              </div>
            );
          })()}

          {/* Prioridade - Menor */}
          <div className={cn(
            "px-2 py-1 rounded-full text-xs font-medium transition-colors",
            ticket.status === 'concluido' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            ticket.prioridade === 'crise' ? 'bg-red-50 text-red-700 border border-red-200' :
            ticket.prioridade === 'imediato' ? 'bg-red-50 text-red-700 border border-red-200' :
            ticket.prioridade === 'ate_1_hora' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
            ticket.prioridade === 'ainda_hoje' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-slate-50 text-slate-700 border border-slate-200'
          )}>
            {ticket.status === 'concluido' ? 'Resolvido' : getPriorityLabel(ticket.prioridade)}
          </div>
        </div>

        {/* SLA countdown - apenas Resolver */}
        {ticket.status !== 'concluido' && ticket.data_limite_sla && (
          <div className="space-y-1 text-xs">
            {/* SLA countdown */}
            {(() => {
              const slaTime = getSLATime(ticket);
              return slaTime && (
                <div className={cn("flex items-center gap-1", slaTime.color)}>
                  <Clock className="h-3 w-3" />
                  <span className="font-mono">{slaTime.text}</span>
                </div>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface KanbanColumnProps {
  status: keyof typeof COLUMN_STATUS;
  individualTickets: Ticket[];
  selectedTicketId: string | null;
  onTicketSelect: (ticketId: string) => void;
  equipes: Array<{ id: string; nome: string }>;
}

const KanbanColumn = ({ status, individualTickets, selectedTicketId, onTicketSelect, equipes }: KanbanColumnProps) => {
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
        "flex flex-col h-full min-h-[600px] w-full rounded-xl border-2 transition-all duration-300 ease-in-out overflow-hidden",
        COLUMN_COLORS[status],
        isOver ? 
          "border-primary bg-gradient-to-b from-primary/5 to-primary/10 shadow-xl scale-[1.02] border-solid" : 
          "border-dashed border-muted/40 hover:border-muted/60"
      )}
    >
      {/* Header da coluna com efeito glass iOS 26 */}
      <div 
        className="flex items-center justify-between p-4 m-2 mb-0 relative overflow-hidden backdrop-blur-xl backdrop-saturate-150"
        style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
        }}
      >
        <div className="relative flex items-center gap-3 z-10">
          {(() => {
            const IconComponent = COLUMN_ICONS[status];
            const iconColor = COLUMN_ICON_COLORS[status];
            return <IconComponent className={`h-5 w-5 ${iconColor}`} />;
          })()}
          <h3 
            className="font-bold text-base tracking-tight"
            style={{ color: 'rgba(0, 0, 0, 0.7)' }}
          >
            {COLUMN_STATUS[status]}
          </h3>
        </div>
        <Badge 
          variant="secondary" 
          className="relative z-10 text-xs backdrop-blur-sm rounded-full font-semibold"
          style={{
            background: 'rgba(255, 255, 255, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            color: 'rgba(0, 0, 0, 0.7)'
          }}
        >
          {individualTickets.length}
        </Badge>
      </div>
      
      {/* Área de drop elegante com scroll limitado */}
      <div className="flex-1 p-5 relative max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {/* Drop zone visual elegante */}
        {isOver && (
          <div className="absolute inset-3 border-2 border-dashed border-primary/40 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-primary/10 flex items-center justify-center z-10 animate-fade-in backdrop-blur-sm">
            <div className="text-center p-6 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30">
              <div className="text-primary font-semibold text-lg mb-1">✓ Solte aqui</div>
              <div className="text-sm text-primary/80 font-medium">{COLUMN_STATUS[status]}</div>
            </div>
          </div>
        )}
        <SortableContext items={individualTickets.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4 pb-6">
            {/* Individual Tickets */}
            {individualTickets.map((ticket) => (
              <KanbanTicketCard
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicketId === ticket.id}
                onSelect={onTicketSelect}
                equipes={equipes}
              />
            ))}
            
            {individualTickets.length === 0 && (
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

// Helper functions for time calculations
const formatTimeRemaining = (targetDate: Date | string, label: string) => {
  const timeData = calculateTimeRemaining(targetDate);
  
  if (timeData.isOverdue) {
    return {
      text: `${label} venceu há ${timeData.hours}h${timeData.remainingMinutes}m`,
      color: 'text-critical',
      priority: 1000 + timeData.minutes // Higher number = more urgent (overdue)
    };
  } else {
    return {
      text: `${label} em ${timeData.hours}h${timeData.remainingMinutes}m`,
      color: timeData.minutes < 120 ? 'text-critical' : timeData.minutes < 240 ? 'text-warning' : 'text-success',
      priority: timeData.minutes // Lower number = more urgent
    };
  }
};

const getEscalationTime = (ticket: Ticket) => {
  if (!ticket.data_limite_sla) return null;
  // Escalation happens when SLA is breached
  return formatTimeRemaining(ticket.data_limite_sla, 'Escalar');
};

const getSLATime = (ticket: Ticket) => {
  if (!ticket.data_limite_sla) return null;
  return formatTimeRemaining(ticket.data_limite_sla, 'Resolver');
};

export const TicketsKanban = ({ tickets, loading, onTicketSelect, selectedTicketId, equipes, showFilters, onToggleFilters, onChangeStatus }: TicketsKanbanProps) => {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [showArchivedTickets, setShowArchivedTickets] = useState(false);
  
  const { activeCrises } = useNewCrisisManagement();

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
    let filteredTickets = tickets.filter(ticket => ticket.status === status);
    
    // For completed tickets, filter out old ones unless showing archived
    if (status === 'concluido' && !showArchivedTickets) {
      filteredTickets = filteredTickets.filter(ticket => !isFromPreviousBusinessDay(ticket.created_at));
    }
    
    // Sort by urgency (escalation time, then SLA time, then creation date)
    return filteredTickets.sort((a, b) => {
      if (a.status === 'concluido') return 1; // Completed tickets at bottom
      if (b.status === 'concluido') return -1;
      
      const aEscalation = getEscalationTime(a);
      const bEscalation = getEscalationTime(b);
      const aSLA = getSLATime(a);
      const bSLA = getSLATime(b);
      
      // Compare escalation urgency first
      if (aEscalation && bEscalation) {
        const diff = aEscalation.priority - bEscalation.priority;
        if (diff !== 0) return diff;
      }
      
      // Then compare SLA urgency
      if (aSLA && bSLA) {
        const diff = aSLA.priority - bSLA.priority;
        if (diff !== 0) return diff;
      }
      
      // Finally by creation date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const getGroupedTicketsAndCrises = (status: keyof typeof COLUMN_STATUS) => {
    const statusTickets = getTicketsByStatus(status);
    const ticketsInCrisis = new Set<string>();
    
    // Mark tickets that are in any crisis
    activeCrises.forEach(crisis => {
      const crisisTicketIds = crisis.crise_ticket_links?.map(link => link.ticket_id) || [];
      crisisTicketIds.forEach(ticketId => ticketsInCrisis.add(ticketId));
    });
    
    // Get only tickets NOT in any crisis
    const individualTickets = statusTickets.filter(ticket => 
      !ticketsInCrisis.has(ticket.id)
    );
    
    return { crisisGroups: [], individualTickets };
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
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex justify-end items-center gap-2">
          {onToggleFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleFilters}
              className="text-xs"
            >
              <Filter className="h-3 w-3 mr-1" />
              {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchivedTickets(!showArchivedTickets)}
            className="text-xs"
          >
            {showArchivedTickets ? 'Ocultar Arquivados' : 'Mostrar Arquivados'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {Object.keys(COLUMN_STATUS).map((status) => {
            const { individualTickets } = getGroupedTicketsAndCrises(status as keyof typeof COLUMN_STATUS);
            return (
              <KanbanColumn
                key={status}
                status={status as keyof typeof COLUMN_STATUS}
                individualTickets={individualTickets}
                selectedTicketId={selectedTicketId}
                onTicketSelect={handleTicketClick}
                equipes={equipes}
              />
            );
          })}
        </div>
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