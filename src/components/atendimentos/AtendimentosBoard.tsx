import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FilaAtendimentos } from './FilaAtendimentos';
import { AtendimentoKanban } from './AtendimentoKanban';
import { AtendimentoDetail } from './AtendimentoDetail';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAtendimentos } from '@/hooks/useAtendimentos';

export function AtendimentosBoard() {
  const [selectedAtendimento, setSelectedAtendimento] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { atendimentos } = useAtendimentos();

  const handleSelectAtendimento = (id: string) => {
    setSelectedAtendimento(id);
  };

  const handleCloseDetail = () => {
    setSelectedAtendimento(null);
  };

  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Mobile: Stack layout */}
        <FilaAtendimentos 
          atendimentos={atendimentos.filter(a => a.status === 'em_fila')}
          onSelectAtendimento={handleSelectAtendimento}
        />
        <AtendimentoKanban 
          atendimentos={atendimentos}
          onSelectAtendimento={handleSelectAtendimento}
        />
        {selectedAtendimento && (
          <AtendimentoDetail 
            atendimentoId={selectedAtendimento}
            onClose={handleCloseDetail}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
      {/* Kanban */}
      <div className={selectedAtendimento ? "col-span-9" : "col-span-12"}>
        <AtendimentoKanban 
          atendimentos={atendimentos}
          onSelectAtendimento={handleSelectAtendimento}
        />
      </div>

      {/* Detalhes (quando selecionado) */}
      {selectedAtendimento && (
        <div className="col-span-3">
          <AtendimentoDetail 
            atendimentoId={selectedAtendimento}
            onClose={handleCloseDetail}
          />
        </div>
      )}
    </div>
  );
}