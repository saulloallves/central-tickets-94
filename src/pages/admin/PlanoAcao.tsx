import React, { useState } from 'react';
import { ClipboardCheck, RefreshCw, Filter, Plus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlanoAcaoKanban } from '@/components/plano-acao/PlanoAcaoKanban';
import { PlanoAcaoDetail } from '@/components/plano-acao/PlanoAcaoDetail';
import { EditPlanoAcaoDialog } from '@/components/plano-acao/EditPlanoAcaoDialog';
import { CreatePlanoAcaoDialog } from '@/components/plano-acao/CreatePlanoAcaoDialog';
import { AcompanhamentoKanban } from '@/components/plano-acao/AcompanhamentoKanban';
import { AcompanhamentoDetail } from '@/components/plano-acao/AcompanhamentoDetail';
import { AddUnidadeDialog } from '@/components/plano-acao/AddUnidadeDialog';
import { AgendarReuniaoDialog } from '@/components/plano-acao/AgendarReuniaoDialog';
import { usePlanoAcao, type PlanoAcao } from '@/hooks/usePlanoAcao';
import { useAcompanhamento, type Acompanhamento } from '@/hooks/useAcompanhamento';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlanoAcaoPage() {
  const { planos, loading, updateStatusFrnq, updatePlano, refetch } = usePlanoAcao();
  const { 
    acompanhamentos, 
    loading: loadingAcomp, 
    addUnidade, 
    agendarReuniao, 
    confirmarReuniao,
    finalizarAcompanhamento,
    refetch: refetchAcomp 
  } = useAcompanhamento();
  
  const [activeTab, setActiveTab] = useState('acompanhamento');
  const [selectedPlano, setSelectedPlano] = useState<PlanoAcao | null>(null);
  const [selectedAcompanhamento, setSelectedAcompanhamento] = useState<Acompanhamento | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<PlanoAcao | null>(null);
  const [addUnidadeDialogOpen, setAddUnidadeDialogOpen] = useState(false);
  const [agendarReuniaoDialogOpen, setAgendarReuniaoDialogOpen] = useState(false);

  const handleChangeStatus = async (planoId: string, newStatus: string) => {
    return await updateStatusFrnq(planoId, newStatus);
  };

  const handlePlanoSelect = (plano: PlanoAcao) => {
    setSelectedPlano(plano);
  };

  const handleEditPlano = () => {
    if (selectedPlano) {
      const planoParaEditar = selectedPlano;
      setEditingPlano(planoParaEditar);
      setEditDialogOpen(true);
      setTimeout(() => setSelectedPlano(null), 0);
    }
  };

  const handleAcompanhamentoSelect = (acompanhamento: Acompanhamento) => {
    setSelectedAcompanhamento(acompanhamento);
  };

  const handleAgendarReuniao = () => {
    if (selectedAcompanhamento) {
      setAgendarReuniaoDialogOpen(true);
    }
  };

  if (loading || loadingAcomp) {
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
    <div className="w-full h-full p-6 space-y-6 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
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
          {activeTab === 'acompanhamento' ? (
            <Button
              onClick={() => setAddUnidadeDialogOpen(true)}
              size="sm"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Adicionar Unidade
            </Button>
          ) : (
            <Button
              onClick={() => setCreateDialogOpen(true)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Plano
            </Button>
          )}

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
            onClick={() => {
              if (activeTab === 'acompanhamento') {
                refetchAcomp();
              } else {
                refetch();
              }
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="acompanhamento">Acompanhamento</TabsTrigger>
          <TabsTrigger value="plano-acao">Plano de Ação</TabsTrigger>
        </TabsList>

        <TabsContent value="acompanhamento" className="flex-1 overflow-hidden mt-4">
          <AcompanhamentoKanban
            acompanhamentos={acompanhamentos}
            onAcompanhamentoSelect={handleAcompanhamentoSelect}
            selectedAcompanhamentoId={selectedAcompanhamento?.id || null}
          />
        </TabsContent>

        <TabsContent value="plano-acao" className="flex-1 overflow-hidden mt-4">
          <PlanoAcaoKanban
            planos={planos}
            onPlanoSelect={handlePlanoSelect}
            selectedPlanoId={selectedPlano?.id || null}
            onChangeStatus={handleChangeStatus}
          />
        </TabsContent>
      </Tabs>

      {/* Modal de Detalhes do Plano */}
      <PlanoAcaoDetail
        plano={selectedPlano}
        isOpen={!!selectedPlano}
        onClose={() => setSelectedPlano(null)}
        onEdit={handleEditPlano}
      />

      {/* Modal de Edição do Plano */}
      <EditPlanoAcaoDialog
        plano={editingPlano}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={refetch}
        onUpdate={updatePlano}
      />

      {/* Modal de Criação do Plano */}
      <CreatePlanoAcaoDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refetch}
      />

      {/* Modal de Adicionar Unidade */}
      <AddUnidadeDialog
        open={addUnidadeDialogOpen}
        onOpenChange={setAddUnidadeDialogOpen}
        onAdd={addUnidade}
      />

      {/* Modal de Detalhes do Acompanhamento */}
      <AcompanhamentoDetail
        acompanhamento={selectedAcompanhamento}
        isOpen={!!selectedAcompanhamento}
        onClose={() => setSelectedAcompanhamento(null)}
        onAgendarReuniao={handleAgendarReuniao}
        onConfirmarReuniao={confirmarReuniao}
        onFinalizarAcompanhamento={finalizarAcompanhamento}
      />

      {/* Modal de Agendar Reunião */}
      <AgendarReuniaoDialog
        open={agendarReuniaoDialogOpen}
        onOpenChange={setAgendarReuniaoDialogOpen}
        acompanhamento={selectedAcompanhamento}
        onAgendar={agendarReuniao}
      />
    </div>
  );
}
