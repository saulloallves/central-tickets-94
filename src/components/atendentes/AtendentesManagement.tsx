import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutDashboard, Users, Settings, AlertTriangle } from 'lucide-react';
import { useAtendentes } from '@/hooks/useAtendentes';
import { CreateAtendenteDialog } from './CreateAtendenteDialog';
import { AtendentesDashboard } from './AtendentesDashboard';
import { AtendentesTable } from './AtendentesTable';
import { AtendentesUnidadesConfig } from './AtendentesUnidadesConfig';
import { EmergencySettingsTab } from '../configuracoes/EmergencySettingsTab';
import { GruposDiagnosticoPage } from './GruposDiagnosticoPage';
import LoadingSpinner from '../LoadingSpinner';

export const AtendentesManagement = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const { 
    atendentes, 
    loading, 
    updateAtendente,
    deleteAtendente,
    updateStatus, 
    redistributeQueue 
  } = useAtendentes();

  const calculateStats = (tipo: 'concierge' | 'dfcom') => {
    const filtered = atendentes.filter(a => a.tipo === tipo);
    const ativos = filtered.filter(a => a.status === 'ativo').length;
    const capacidadeTotal = filtered.reduce((acc, a) => acc + a.capacidade_maxima, 0);
    const capacidadeUsada = filtered.reduce((acc, a) => acc + a.capacidade_atual, 0);
    
    return {
      total: filtered.length,
      ativos,
      capacidadeTotal,
      capacidadeUsada,
      capacidadeDisponivel: capacidadeTotal - capacidadeUsada
    };
  };

  const conciergeStats = calculateStats('concierge');
  const dfcomStats = calculateStats('dfcom');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestão de Atendentes</h2>
          <p className="text-muted-foreground">
            Gerencie atendentes Concierge e DFCom
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDashboard(true)}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Atendente
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Concierge
            </CardTitle>
            <CardDescription>Atendimento geral e primeiro contato</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{conciergeStats.ativos}/{conciergeStats.total}</div>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{conciergeStats.capacidadeDisponivel}</div>
                <p className="text-xs text-muted-foreground">Capacidade Disponível</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              DFCom
            </CardTitle>
            <CardDescription>Suporte técnico especializado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold">{dfcomStats.ativos}/{dfcomStats.total}</div>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{dfcomStats.capacidadeDisponivel}</div>
                <p className="text-xs text-muted-foreground">Capacidade Disponível</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com conteúdo organizado */}
      <Tabs defaultValue="atendentes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="atendentes">
            <Users className="mr-2 h-4 w-4" />
            Atendentes
          </TabsTrigger>
          <TabsTrigger value="unidades">
            <Settings className="mr-2 h-4 w-4" />
            Configuração por Unidade
          </TabsTrigger>
          <TabsTrigger value="diagnostico">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Diagnóstico de Grupos
          </TabsTrigger>
          <TabsTrigger value="emergencia">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Protocolo de Emergência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atendentes" className="space-y-4">
          <AtendentesTable
            atendentes={atendentes}
            onUpdate={updateAtendente}
            onDelete={deleteAtendente}
            onStatusChange={updateStatus}
          />
        </TabsContent>

        <TabsContent value="unidades">
          <AtendentesUnidadesConfig />
        </TabsContent>

        <TabsContent value="diagnostico">
          <GruposDiagnosticoPage />
        </TabsContent>

        <TabsContent value="emergencia">
          <EmergencySettingsTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateAtendenteDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
      
      <AtendentesDashboard 
        open={showDashboard} 
        onOpenChange={setShowDashboard} 
      />
    </div>
  );
};
