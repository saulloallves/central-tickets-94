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
      {/* Coluna 1: Fila Atual */}
      <div className="col-span-3">
        <Card className="h-full">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              🟡 Fila Atual
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <FilaAtendimentos 
              atendimentos={atendimentos.filter(a => a.status === 'em_fila')}
              onSelectAtendimento={handleSelectAtendimento}
            />
          </CardContent>
        </Card>
      </div>

      {/* Coluna 2: Kanban */}
      <div className={selectedAtendimento ? "col-span-6" : "col-span-9"}>
        <AtendimentoKanban 
          atendimentos={atendimentos}
          onSelectAtendimento={handleSelectAtendimento}
        />
      </div>

      {/* Coluna 3: Detalhes (quando selecionado) */}
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