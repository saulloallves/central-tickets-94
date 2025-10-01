import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FilaAtendimentos } from './FilaAtendimentos';
import { AtendimentoKanban } from './AtendimentoKanban';
import { AtendimentoDetail } from './AtendimentoDetail';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAtendimentos } from '@/hooks/useAtendimentos';

export function AtendimentosBoard() {
  const [selectedAtendimento, setSelectedAtendimento] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { atendimentos, refreshAtendimentos } = useAtendimentos();

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
          onRefresh={refreshAtendimentos}
        />
        
        {/* Modal para detalhes do atendimento */}
        <Dialog open={!!selectedAtendimento} onOpenChange={(open) => !open && handleCloseDetail()}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedAtendimento && (
              <AtendimentoDetail 
                atendimentoId={selectedAtendimento}
                onClose={handleCloseDetail}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-200px)]">
        {/* Kanban ocupando toda a largura */}
        <AtendimentoKanban 
          atendimentos={atendimentos}
          onSelectAtendimento={handleSelectAtendimento}
          onRefresh={refreshAtendimentos}
        />
      </div>

      {/* Modal para detalhes do atendimento */}
      <Dialog open={!!selectedAtendimento} onOpenChange={(open) => !open && handleCloseDetail()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedAtendimento && (
            <AtendimentoDetail 
              atendimentoId={selectedAtendimento}
              onClose={handleCloseDetail}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}