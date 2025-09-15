import React, { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AtendimentoCard } from './AtendimentoCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAtendimentoDragDrop } from '@/hooks/useAtendimentoDragDrop';

interface AtendimentoKanbanProps {
  atendimentos: any[];
  onSelectAtendimento: (id: string) => void;
}

interface SortableAtendimentoCardProps {
  atendimento: any;
  onClick: () => void;
}

function SortableAtendimentoCard({ atendimento, onClick }: SortableAtendimentoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: atendimento.id });

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
    >
      <AtendimentoCard
        atendimento={atendimento}
        onClick={onClick}
      />
    </div>
  );
}

interface DroppableColumnProps {
  id: string;
  title: string;
  emoji: string;
  bgColor: string;
  borderColor: string;
  atendimentos: any[];
  onSelectAtendimento: (id: string) => void;
}

function DroppableColumn({
  id,
  title,
  emoji,
  bgColor,
  borderColor,
  atendimentos,
  onSelectAtendimento
}: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <Card className={`h-full ${bgColor} ${borderColor}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span>{emoji}</span>
          <span>{title}</span>
          <span className="ml-auto bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs">
            {atendimentos.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-350px)]">
          <div ref={setNodeRef} className="space-y-3 p-4 min-h-[200px]">
            <SortableContext items={atendimentos.map(a => a.id)} strategy={verticalListSortingStrategy}>
              {atendimentos.map((atendimento) => (
                <SortableAtendimentoCard
                  key={atendimento.id}
                  atendimento={atendimento}
                  onClick={() => onSelectAtendimento(atendimento.id)}
                />
              ))}
            </SortableContext>
            {atendimentos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-2xl mb-2">{emoji}</div>
                <p className="text-sm">Nenhum atendimento</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

const KANBAN_COLUMNS = [
  { 
    id: 'em_fila', 
    title: 'Em Fila', 
    emoji: '🟡',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800'
  },
  { 
    id: 'em_atendimento', 
    title: 'Em Atendimento', 
    emoji: '🔵',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  { 
    id: 'finalizado', 
    title: 'Finalizado', 
    emoji: '🟢',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200 dark:border-green-800'
  },
];

export function AtendimentoKanban({ atendimentos, onSelectAtendimento }: AtendimentoKanbanProps) {
  const [activeAtendimento, setActiveAtendimento] = useState<any | null>(null);
  const { updateAtendimentoStatus } = useAtendimentoDragDrop();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getAtendimentosByStatus = (status: string) => {
    return atendimentos.filter(a => a.status === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const atendimento = atendimentos.find(a => a.id === active.id);
    setActiveAtendimento(atendimento);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveAtendimento(null);
      return;
    }

    const atendimentoId = active.id as string;
    const newStatus = over.id as string;
    
    // Find the atendimento and its current status
    const atendimento = atendimentos.find(a => a.id === atendimentoId);
    if (!atendimento) {
      setActiveAtendimento(null);
      return;
    }

    const oldStatus = atendimento.status;
    
    if (oldStatus !== newStatus) {
      console.log(`Moving atendimento ${atendimentoId} from ${oldStatus} to ${newStatus}`);
      await updateAtendimentoStatus(atendimentoId, newStatus);
    }

    setActiveAtendimento(null);
  };

  return (
    <div className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-4 h-full">
          {KANBAN_COLUMNS.map((column) => {
            const columnAtendimentos = getAtendimentosByStatus(column.id);
            
            return (
              <DroppableColumn
                key={column.id}
                id={column.id}
                title={column.title}
                emoji={column.emoji}
                bgColor={column.bgColor}
                borderColor={column.borderColor}
                atendimentos={columnAtendimentos}
                onSelectAtendimento={onSelectAtendimento}
              />
            );
          })}
        </div>
        
        <DragOverlay>
          {activeAtendimento ? (
            <AtendimentoCard
              atendimento={activeAtendimento}
              onClick={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}