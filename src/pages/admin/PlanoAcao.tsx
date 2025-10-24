import React, { useState } from 'react';
import { ClipboardCheck, RefreshCw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlanoAcaoKanban } from '@/components/plano-acao/PlanoAcaoKanban';
import { PlanoAcaoDetail } from '@/components/plano-acao/PlanoAcaoDetail';
import { usePlanoAcao, type PlanoAcao } from '@/hooks/usePlanoAcao';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlanoAcaoPage() {
  const { planos, loading, updateStatusFrnq, refetch } = usePlanoAcao();
  const [selectedPlano, setSelectedPlano] = useState<PlanoAcao | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const handleChangeStatus = async (planoId: string, newStatus: string) => {
    return await updateStatusFrnq(planoId, newStatus);
  };

  const handlePlanoSelect = (plano: PlanoAcao) => {
    setSelectedPlano(plano);
  };

  if (loading) {
    return (
      <div className="w-full h-full p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[600px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-6 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Plano de Ação</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie planos de ação operacionais das unidades
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {['aberto', 'pendente', 'em_andamento', 'reaberto', 'concluido'].map((status) => {
          const count = planos.filter(p => p.status_frnq === status).length;
          const labels: Record<string, string> = {
            aberto: 'Abertos',
            pendente: 'Pendentes',
            em_andamento: 'Em Andamento',
            reaberto: 'Reabertos',
            concluido: 'Concluídos'
          };
          
          return (
            <div key={status} className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">{labels[status]}</p>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Kanban */}
      <PlanoAcaoKanban
        planos={planos}
        onPlanoSelect={handlePlanoSelect}
        selectedPlanoId={selectedPlano?.id || null}
        onChangeStatus={handleChangeStatus}
      />

      {/* Modal de Detalhes */}
      <PlanoAcaoDetail
        plano={selectedPlano}
        isOpen={!!selectedPlano}
        onClose={() => setSelectedPlano(null)}
      />
    </div>
  );
}
