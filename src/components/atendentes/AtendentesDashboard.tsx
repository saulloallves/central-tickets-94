import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAtendentes } from '@/hooks/useAtendentes';
import { supabase } from '@/integrations/supabase/client';

interface AtendentesDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DashboardStats {
  totalAtendentes: number;
  atendentesConcierge: number;
  atendentesDfcom: number;
  atendentesAtivos: number;
  capacidadeTotal: number;
  capacidadeUsada: number;
  utilizacaoGeral: number;
  chamadosEmFila: number;
  tempoMedioAtendimento: number;
}

export const AtendentesDashboard = ({ open, onOpenChange }: AtendentesDashboardProps) => {
  const { atendentes, loading, refetch } = useAtendentes();
  const [stats, setStats] = useState<DashboardStats>({
    totalAtendentes: 0,
    atendentesConcierge: 0,
    atendentesDfcom: 0,
    atendentesAtivos: 0,
    capacidadeTotal: 0,
    capacidadeUsada: 0,
    utilizacaoGeral: 0,
    chamadosEmFila: 0,
    tempoMedioAtendimento: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const calculateStats = async () => {
    const totalAtendentes = atendentes.length;
    const atendentesConcierge = atendentes.filter(a => a.tipo === 'concierge').length;
    const atendentesDfcom = atendentes.filter(a => a.tipo === 'dfcom').length;
    const atendentesAtivos = atendentes.filter(a => a.status === 'ativo').length;
    const capacidadeTotal = atendentes.reduce((acc, a) => acc + a.capacidade_maxima, 0);
    const capacidadeUsada = atendentes.reduce((acc, a) => acc + a.capacidade_atual, 0);
    const utilizacaoGeral = capacidadeTotal > 0 ? (capacidadeUsada / capacidadeTotal) * 100 : 0;

    // Buscar dados de chamados em fila
    const { data: chamadosData } = await supabase
      .from('chamados')
      .select('*')
      .eq('status', 'em_fila');

    const chamadosEmFila = chamadosData?.length || 0;

    // Calcular tempo médio de atendimento (últimas 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: chamadosFinalizados } = await supabase
      .from('chamados')
      .select('criado_em, atualizado_em')
      .eq('status', 'finalizado')
      .gte('atualizado_em', oneDayAgo.toISOString());

    let tempoMedioAtendimento = 0;
    if (chamadosFinalizados && chamadosFinalizados.length > 0) {
      const tempoTotal = chamadosFinalizados.reduce((acc, chamado) => {
        const inicio = new Date(chamado.criado_em);
        const fim = new Date(chamado.atualizado_em);
        return acc + (fim.getTime() - inicio.getTime());
      }, 0);
      tempoMedioAtendimento = Math.round(tempoTotal / chamadosFinalizados.length / 1000 / 60); // em minutos
    }

    setStats({
      totalAtendentes,
      atendentesConcierge,
      atendentesDfcom,
      atendentesAtivos,
      capacidadeTotal,
      capacidadeUsada,
      utilizacaoGeral,
      chamadosEmFila,
      tempoMedioAtendimento,
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    await calculateStats();
    setRefreshing(false);
  };

  useEffect(() => {
    if (open && !loading) {
      calculateStats();
    }
  }, [open, atendentes, loading]);

  const getUtilizacaoColor = (utilizacao: number) => {
    if (utilizacao >= 90) return 'text-red-600';
    if (utilizacao >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Dashboard de Atendentes
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cards de Estatísticas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Atendentes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalAtendentes}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.atendentesAtivos} ativos agora
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Utilização Geral</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getUtilizacaoColor(stats.utilizacaoGeral)}`}>
                  {stats.utilizacaoGeral.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.capacidadeUsada}/{stats.capacidadeTotal} capacidade
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fila de Espera</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.chamadosEmFila}</div>
                <p className="text-xs text-muted-foreground">chamados aguardando</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.tempoMedioAtendimento}min</div>
                <p className="text-xs text-muted-foreground">atendimento (24h)</p>
              </CardContent>
            </Card>
          </div>

          {/* Distribuição por Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Concierge</CardTitle>
                <CardDescription>Atendentes de concierge</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Total</span>
                    <span className="font-medium">{stats.atendentesConcierge}</span>
                  </div>
                  {atendentes
                    .filter(a => a.tipo === 'concierge')
                    .map(atendente => (
                      <div key={atendente.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{atendente.nome}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              atendente.status === 'ativo' ? 'border-green-500 text-green-700' :
                              atendente.status === 'pausa' ? 'border-yellow-500 text-yellow-700' :
                              'border-gray-500 text-gray-700'
                            }
                          >
                            {atendente.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {atendente.capacidade_atual}/{atendente.capacidade_maxima}
                          </div>
                          <Progress 
                            value={(atendente.capacidade_atual / atendente.capacidade_maxima) * 100} 
                            className="w-16 h-2" 
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">DFCom</CardTitle>
                <CardDescription>Atendentes de suporte técnico</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Total</span>
                    <span className="font-medium">{stats.atendentesDfcom}</span>
                  </div>
                  {atendentes
                    .filter(a => a.tipo === 'dfcom')
                    .map(atendente => (
                      <div key={atendente.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{atendente.nome}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              atendente.status === 'ativo' ? 'border-green-500 text-green-700' :
                              atendente.status === 'pausa' ? 'border-yellow-500 text-yellow-700' :
                              'border-gray-500 text-gray-700'
                            }
                          >
                            {atendente.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {atendente.capacidade_atual}/{atendente.capacidade_maxima}
                          </div>
                          <Progress 
                            value={(atendente.capacidade_atual / atendente.capacidade_maxima) * 100} 
                            className="w-16 h-2" 
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alertas e Recomendações */}
          {(stats.utilizacaoGeral > 85 || stats.chamadosEmFila > 10) && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-lg text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Alertas do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.utilizacaoGeral > 85 && (
                  <div className="text-sm text-yellow-800">
                    ⚠️ <strong>Alta utilização:</strong> Capacidade em {stats.utilizacaoGeral.toFixed(1)}%. 
                    Considere adicionar mais atendentes ou redistribuir a carga.
                  </div>
                )}
                {stats.chamadosEmFila > 10 && (
                  <div className="text-sm text-yellow-800">
                    ⚠️ <strong>Fila crescente:</strong> {stats.chamadosEmFila} chamados aguardando. 
                    Verifique a disponibilidade dos atendentes.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};