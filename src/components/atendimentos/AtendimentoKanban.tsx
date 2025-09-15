import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AtendimentoCard } from './AtendimentoCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AtendimentoKanbanProps {
  atendimentos: any[];
  onSelectAtendimento: (id: string) => void;
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
  const getAtendimentosByStatus = (status: string) => {
    return atendimentos.filter(a => a.status === status);
  };

  return (
    <div className="h-full">
      <div className="grid grid-cols-3 gap-4 h-full">
        {KANBAN_COLUMNS.map((column) => {
          const columnAtendimentos = getAtendimentosByStatus(column.id);
          
          return (
            <Card key={column.id} className={`h-full ${column.bgColor} ${column.borderColor}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span>{column.emoji}</span>
                  <span>{column.title}</span>
                  <span className="ml-auto bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs">
                    {columnAtendimentos.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-350px)]">
                  <div className="space-y-3 p-4">
                    {columnAtendimentos.map((atendimento) => (
                      <AtendimentoCard
                        key={atendimento.id}
                        atendimento={atendimento}
                        onClick={() => onSelectAtendimento(atendimento.id)}
                      />
                    ))}
                    {columnAtendimentos.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <div className="text-2xl mb-2">{column.emoji}</div>
                        <p className="text-sm">Nenhum atendimento</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}