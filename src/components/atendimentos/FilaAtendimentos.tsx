import React from 'react';
import { AtendimentoCard } from './AtendimentoCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FilaAtendimentosProps {
  atendimentos: any[];
  onSelectAtendimento: (id: string) => void;
}

export function FilaAtendimentos({ atendimentos, onSelectAtendimento }: FilaAtendimentosProps) {
  return (
    <ScrollArea className="h-[calc(100vh-300px)]">
      <div className="space-y-3 p-4">
        {atendimentos.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              <div className="text-2xl mb-2">🎉</div>
              <p>Nenhum atendimento na fila</p>
            </div>
          </div>
        ) : (
          atendimentos.map((atendimento, index) => (
            <div key={atendimento.id} className="relative">
              <div className="absolute -left-2 top-3 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold z-10">
                {index + 1}
              </div>
              <AtendimentoCard
                atendimento={atendimento}
                onClick={() => onSelectAtendimento(atendimento.id)}
                compact
              />
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}