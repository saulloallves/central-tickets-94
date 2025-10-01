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
import { Clock, UserCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AtendimentoKanbanProps {
  atendimentos: any[];
  onSelectAtendimento: (id: string) => void;
  onRefresh?: () => void;
}

interface SortableAtendimentoCardProps {
  atendimento: any;
  onClick: () => void;
  onRefresh?: () => void;
}

function SortableAtendimentoCard({ atendimento, onClick, onRefresh }: SortableAtendimentoCardProps) {
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
        onRefresh={onRefresh}
      />
    </div>
  );
}

interface DroppableColumnProps {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  atendimentos: any[];
  onSelectAtendimento: (id: string) => void;
  onRefresh?: () => void;
}

function DroppableColumn({
  id,
  title,
  icon: Icon,
  atendimentos,
  onSelectAtendimento,
  onRefresh
}: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4" />
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
                  onRefresh={onRefresh}
                />
              ))}
            </SortableContext>
            {atendimentos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Icon className="h-8 w-8 mx-auto mb-2" />
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
    id: 'emergencia', 
    title: 'Emergência', 
    icon: AlertTriangle
  },
  { 
    id: 'em_fila', 
    title: 'Em Fila', 
    icon: Clock
  },
  { 
    id: 'em_atendimento', 
    title: 'Em Atendimento', 
    icon: UserCheck
  },
  { 
    id: 'finalizado', 
    title: 'Finalizado', 
    icon: CheckCircle2
  },
];

export function AtendimentoKanban({ atendimentos, onSelectAtendimento, onRefresh }: AtendimentoKanbanProps) {
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
    let newStatus = over.id as string;
    
    // Se o over.id for um UUID de outro atendimento, pegar o status da coluna pai
    const validStatuses = ['emergencia', 'em_fila', 'em_atendimento', 'finalizado'];
    if (!validStatuses.includes(newStatus)) {
      // Encontrar o atendimento que está sendo dropado
      const targetAtendimento = atendimentos.find(a => a.id === newStatus);
      if (targetAtendimento) {
        newStatus = targetAtendimento.status;
      } else {
        console.error('❌ Invalid drop target:', newStatus);
        setActiveAtendimento(null);
        return;
      }
    }
    
    // Find the atendimento and its current status
    const atendimento = atendimentos.find(a => a.id === atendimentoId);
    if (!atendimento) {
      setActiveAtendimento(null);
      return;
    }

    const oldStatus = atendimento.status;
    
    if (oldStatus !== newStatus) {
      console.log(`Moving atendimento ${atendimentoId} from ${oldStatus} to ${newStatus}`);
      
      // ATUALIZAÇÃO OTIMÍSTICA: atualizar o estado local imediatamente
      // Chamar o callback para atualizar o atendimento no estado pai
      const updatedAtendimento = { ...atendimento, status: newStatus };
      
      // Como não temos acesso direto ao setter, vamos tentar forçar uma re-renderização
      // através do sistema de real-time simulado
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('atendimento-optimistic-update', {
          detail: { atendimento: updatedAtendimento }
        }));
      }
      
      try {
        await updateAtendimentoStatus(atendimentoId, newStatus);
      } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        // Em caso de erro, reverter a mudança otimística
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('atendimento-optimistic-update', {
            detail: { atendimento: atendimento } // reverter para o original
          }));
        }
      }
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
        <div className="grid grid-cols-4 gap-4 h-full">
          {KANBAN_COLUMNS.map((column) => {
            const columnAtendimentos = getAtendimentosByStatus(column.id);
            
            return (
              <DroppableColumn
                key={column.id}
                id={column.id}
                title={column.title}
                icon={column.icon}
                atendimentos={columnAtendimentos}
                onSelectAtendimento={onSelectAtendimento}
                onRefresh={onRefresh}
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