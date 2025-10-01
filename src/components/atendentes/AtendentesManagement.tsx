import { useState, useEffect } from 'react';
import { Plus, Users, Clock, Phone, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAtendentes } from '@/hooks/useAtendentes';
import { AtendenteCard } from './AtendenteCard';
import { CreateAtendenteDialog } from './CreateAtendenteDialog';
import { AtendentesDashboard } from './AtendentesDashboard';
import { AtendentesUnidadesConfig } from './AtendentesUnidadesConfig';
import { EmergencySettingsTab } from '@/components/configuracoes/EmergencySettingsTab';
import { Separator } from '@/components/ui/separator';

export const AtendentesManagement = () => {
  const { atendentes, loading, updateStatus, redistributeQueue } = useAtendentes();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-500';
      case 'pausa': return 'bg-yellow-500';
      case 'almoco': return 'bg-orange-500';
      case 'indisponivel': return 'bg-red-500';
      case 'inativo': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ativo': return 'Ativo';
      case 'pausa': return 'Em Pausa';
      case 'almoco': return 'Almoço';
      case 'indisponivel': return 'Indisponível';
      case 'inativo': return 'Inativo';
      default: return status;
    }
  };

  const atendentesConcierge = atendentes.filter(a => a.tipo === 'concierge');
  const atendentesDfcom = atendentes.filter(a => a.tipo === 'dfcom');

  const calculateStats = (lista: typeof atendentes) => {
    const ativos = lista.filter(a => a.status === 'ativo').length;
    const totalCapacidade = lista.reduce((acc, a) => acc + a.capacidade_maxima, 0);
    const capacidadeUsada = lista.reduce((acc, a) => acc + a.capacidade_atual, 0);
    const utilizacao = totalCapacidade > 0 ? (capacidadeUsada / totalCapacidade) * 100 : 0;

    return { ativos, total: lista.length, utilizacao, capacidadeUsada, totalCapacidade };
  };

  const statsConcierge = calculateStats(atendentesConcierge);
  const statsDfcom = calculateStats(atendentesDfcom);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Carregando atendentes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Atendentes</h2>
          <p className="text-muted-foreground">
            Gerencie atendentes, status e capacidade em tempo real
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowDashboard(true)}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Dashboard
          </Button>
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo Atendente
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concierge</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsConcierge.ativos}/{statsConcierge.total}
            </div>
            <p className="text-xs text-muted-foreground">atendentes ativos</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span>Utilização</span>
                <span>{statsConcierge.utilizacao.toFixed(1)}%</span>
              </div>
              <Progress value={statsConcierge.utilizacao} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {statsConcierge.capacidadeUsada}/{statsConcierge.totalCapacidade} capacidade
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DFCom</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsDfcom.ativos}/{statsDfcom.total}
            </div>
            <p className="text-xs text-muted-foreground">atendentes ativos</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span>Utilização</span>
                <span>{statsDfcom.utilizacao.toFixed(1)}%</span>
              </div>
              <Progress value={statsDfcom.utilizacao} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {statsDfcom.capacidadeUsada}/{statsDfcom.totalCapacidade} capacidade
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuração de Atendentes por Unidade */}
      <AtendentesUnidadesConfig />

      <Separator className="my-8" />

      {/* Configurações de Emergência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Protocolo de Emergência Fora do Horário
          </CardTitle>
          <CardDescription>
            Configure os números que serão acionados automaticamente quando uma emergência for solicitada fora do horário de atendimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmergencySettingsTab />
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Concierge Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Atendentes Concierge ({atendentesConcierge.length})
          </CardTitle>
          <CardDescription>
            Atendentes responsáveis pelo serviço de concierge
          </CardDescription>
        </CardHeader>
        <CardContent>
          {atendentesConcierge.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum atendente concierge cadastrado
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {atendentesConcierge.map((atendente) => (
                <AtendenteCard
                  key={atendente.id}
                  atendente={atendente}
                  onStatusChange={updateStatus}
                  onRedistribute={redistributeQueue}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DFCom Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Atendentes DFCom ({atendentesDfcom.length})
          </CardTitle>
          <CardDescription>
            Atendentes responsáveis pelo suporte técnico DFCom
          </CardDescription>
        </CardHeader>
        <CardContent>
          {atendentesDfcom.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum atendente DFCom cadastrado
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {atendentesDfcom.map((atendente) => (
                <AtendenteCard
                  key={atendente.id}
                  atendente={atendente}
                  onStatusChange={updateStatus}
                  onRedistribute={redistributeQueue}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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