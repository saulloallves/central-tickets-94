import React, { useState, memo } from 'react';
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
import { 
  Circle, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Building2,
  User,
  Calendar
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PlanoAcao } from '@/hooks/usePlanoAcao';

interface PlanoAcaoKanbanProps {
  planos: PlanoAcao[];
  onPlanoSelect: (plano: PlanoAcao) => void;
  selectedPlanoId: string | null;
  onChangeStatus: (planoId: string, newStatus: string) => Promise<boolean>;
}

const COLUMN_STATUS = {
  aberto: 'Aberto',
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  reaberto: 'Reaberto',
  concluido: 'Concluído'
};

const COLUMN_ICONS = {
  aberto: Circle,
  pendente: Clock,
  em_andamento: AlertTriangle,
  reaberto: RotateCcw,
  concluido: CheckCircle2
};

const COLUMN_COLORS = {
  aberto: 'border-border bg-background',
  pendente: 'border-border bg-background',
  em_andamento: 'border-border bg-background',
  reaberto: 'border-border bg-background',
  concluido: 'border-border bg-background'
};

const ICON_COLORS = {
  aberto: 'text-blue-500',
  pendente: 'text-yellow-500',
  em_andamento: 'text-orange-500',
  reaberto: 'text-red-500',
  concluido: 'text-green-500'
};

const getCategoryEmoji = (categoria: string | null) => {
  if (!categoria) return '📋';
  const match = categoria.match(/^([\u{1F300}-\u{1F9FF}])/u);
  return match ? match[1] : '📋';
};

interface SortablePlanoCardProps {
  plano: PlanoAcao;
  isSelected: boolean;
  onSelect: (plano: PlanoAcao) => void;
}

const SortablePlanoCard = memo(({ plano, isSelected, onSelect }: SortablePlanoCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plano.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(plano)}
      className={cn(
        'cursor-pointer transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
    >
      <Card className="hover:shadow-lg border border-slate-300 dark:border-slate-700 shadow-sm bg-card">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm line-clamp-2">
              {plano.titulo || 'Sem título'}
            </p>
            <span className="text-lg shrink-0">
              {getCategoryEmoji(plano.categoria)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">
              {plano.unidade?.name || `Código ${plano.codigo_grupo}`}
            </span>
          </div>

          {plano.responsavel_local && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{plano.responsavel_local}</span>
            </div>
          )}

          {plano.prazo && (
            <div className="flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              <span>{plano.prazo}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

SortablePlanoCard.displayName = 'SortablePlanoCard';

interface KanbanColumnProps {
  status: keyof typeof COLUMN_STATUS;
  planos: PlanoAcao[];
  selectedPlanoId: string | null;
  onPlanoSelect: (plano: PlanoAcao) => void;
}

const KanbanColumn = ({ status, planos, selectedPlanoId, onPlanoSelect }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const Icon = COLUMN_ICONS[status];
  
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col border-2 rounded-lg transition-colors h-full',
        COLUMN_COLORS[status],
        isOver && 'ring-2 ring-primary'
      )}
    >
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", ICON_COLORS[status])} />
          <span className="font-semibold text-sm">{COLUMN_STATUS[status]}</span>
        </div>
        <Badge variant="secondary">{planos.length}</Badge>
      </div>

      <ScrollArea className="flex-1 p-2">
        <SortableContext items={planos.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {planos.map((plano) => (
              <SortablePlanoCard
                key={plano.id}
                plano={plano}
                isSelected={selectedPlanoId === plano.id}
                onSelect={onPlanoSelect}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
};

export const PlanoAcaoKanban = ({
  planos,
  onPlanoSelect,
  selectedPlanoId,
  onChangeStatus
}: PlanoAcaoKanbanProps) => {
  const [activePlano, setActivePlano] = useState<PlanoAcao | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getPlanosByStatus = (status: string) => {
    return planos.filter(p => p.status_frnq === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const plano = planos.find(p => p.id === event.active.id);
    setActivePlano(plano || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActivePlano(null);

    if (!over || active.id === over.id) return;

    const planoId = active.id as string;
    const newStatus = over.id as string;

    await onChangeStatus(planoId, newStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-5 gap-4 h-[calc(100vh-250px)]">
        {Object.keys(COLUMN_STATUS).map((status) => (
          <KanbanColumn
            key={status}
            status={status as keyof typeof COLUMN_STATUS}
            planos={getPlanosByStatus(status)}
            selectedPlanoId={selectedPlanoId}
            onPlanoSelect={onPlanoSelect}
          />
        ))}
      </div>

      <DragOverlay>
        {activePlano && (
          <Card className="opacity-90 rotate-3 cursor-grabbing">
            <CardContent className="p-3">
              <p className="font-semibold text-sm">
                {activePlano.titulo || 'Sem título'}
              </p>
            </CardContent>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
};
