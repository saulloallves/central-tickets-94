import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FilaAtendimentos } from './FilaAtendimentos';
import { AtendimentoKanban } from './AtendimentoKanban';
import { AtendimentoDetail } from './AtendimentoDetail';
import { AtendentesFilter } from './AtendentesFilter';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { useAtendentesFilter } from '@/hooks/useAtendentesFilter';

export function AtendimentosBoard() {
  const [selectedAtendimento, setSelectedAtendimento] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { atendimentos, refreshAtendimentos } = useAtendimentos();
  const { 
    atendentes, 
    selectedAtendenteId, 
    setSelectedAtendenteId, 
    filterAtendimentos 
  } = useAtendentesFilter();

  // Filtrar atendimentos pelo atendente selecionado
  const filteredAtendimentos = useMemo(() => {
    return filterAtendimentos(atendimentos);
  }, [atendimentos, selectedAtendenteId]);

  // Calcular contadores de atendimentos por atendente
  const atendimentosCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    atendimentos.forEach(atendimento => {
      if (atendimento.atendente_id) {
        counts[atendimento.atendente_id] = (counts[atendimento.atendente_id] || 0) + 1;
      }
    });
    return counts;
  }, [atendimentos]);

  const handleSelectAtendimento = (id: string) => {
    setSelectedAtendimento(id);
  };

  const handleCloseDetail = () => {
    setSelectedAtendimento(null);
  };

  if (isMobile) {
    return (
      <div className="space-y-4">
        <AtendentesFilter
          atendentes={atendentes}
          selectedAtendenteId={selectedAtendenteId}
          onSelectAtendente={setSelectedAtendenteId}
          atendimentosCounts={atendimentosCounts}
        />
        
        {/* Mobile: Stack layout */}
        <FilaAtendimentos 
          atendimentos={filteredAtendimentos.filter(a => a.status === 'em_fila')}
          onSelectAtendimento={handleSelectAtendimento}
        />
        <AtendimentoKanban 
          atendimentos={filteredAtendimentos}
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
      <AtendentesFilter
        atendentes={atendentes}
        selectedAtendenteId={selectedAtendenteId}
        onSelectAtendente={setSelectedAtendenteId}
        atendimentosCounts={atendimentosCounts}
      />
      
      <div className="h-[calc(100vh-280px)]">
        {/* Kanban ocupando toda a largura */}
        <AtendimentoKanban 
          atendimentos={filteredAtendimentos}
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