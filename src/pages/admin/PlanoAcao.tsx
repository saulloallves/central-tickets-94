import React, { useState } from 'react';
import { ClipboardCheck, RefreshCw, Filter, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlanoAcaoKanban } from '@/components/plano-acao/PlanoAcaoKanban';
import { PlanoAcaoDetail } from '@/components/plano-acao/PlanoAcaoDetail';
import { EditPlanoAcaoDialog } from '@/components/plano-acao/EditPlanoAcaoDialog';
import { CreatePlanoAcaoDialog } from '@/components/plano-acao/CreatePlanoAcaoDialog';
import { usePlanoAcao, type PlanoAcao } from '@/hooks/usePlanoAcao';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlanoAcaoPage() {
  const { planos, loading, updateStatusFrnq, updatePlano, refetch } = usePlanoAcao();
  const [selectedPlano, setSelectedPlano] = useState<PlanoAcao | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<PlanoAcao | null>(null);

  const handleChangeStatus = async (planoId: string, newStatus: string) => {
    return await updateStatusFrnq(planoId, newStatus);
  };

  const handlePlanoSelect = (plano: PlanoAcao) => {
    setSelectedPlano(plano);
  };

  const handleEditPlano = () => {
    if (selectedPlano) {
      // Salvar referência antes de limpar para evitar perda de dados
      const planoParaEditar = selectedPlano;
      setEditingPlano(planoParaEditar);
      setEditDialogOpen(true);
      // Aguardar próximo render para fechar o modal de detalhes
      setTimeout(() => setSelectedPlano(null), 0);
    }
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
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Plano
          </Button>

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
        onEdit={handleEditPlano}
      />

      {/* Modal de Edição */}
      <EditPlanoAcaoDialog
        plano={editingPlano}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={refetch}
        onUpdate={updatePlano}
      />

      {/* Modal de Criação */}
      <CreatePlanoAcaoDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
}
