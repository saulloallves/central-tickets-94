import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle, Clock, AlertTriangle, TrendingUp, BarChart3, AlertCircle, RefreshCw, Ticket, Timer } from "lucide-react";
import { DashboardFilters, DashboardFiltersState } from "@/components/dashboard/DashboardFilters";
import { KPICardWithTrend } from "@/components/dashboard/KPICardWithTrend";
import { InternalAlertsPanel } from "@/components/dashboard/InternalAlertsPanel";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useTeamMetrics } from "@/hooks/useTeamMetrics";
import { useRole } from "@/hooks/useRole";
import { useUserEquipes } from "@/hooks/useUserEquipes";
import { debounce } from "@/lib/debounce";

const Dashboard = () => {
  const { isAdmin, isDiretor } = useRole();
  const { userEquipes, getPrimaryEquipe } = useUserEquipes();
  const primaryEquipe = getPrimaryEquipe();
  
  // Estado dos filtros
  const [filters, setFilters] = useState<DashboardFiltersState>({
    periodo: 'hoje',
    dataInicio: new Date(),
    dataFim: new Date(),
    visao: 'geral',
  });

  // Determinar visões permitidas baseado no papel do usuário
  const allowedViews = (() => {
    if (isAdmin() || isDiretor()) return ['geral', 'equipe', 'unidade'] as const;
    if (userEquipes && userEquipes.length > 0) return ['geral', 'equipe'] as const;
    return ['geral'] as const;
  })();

  // Auto-selecionar equipe primária se usuário tem equipe e mudou para visão por equipe
  useEffect(() => {
    if (filters.visao === 'equipe' && !filters.equipe_id && primaryEquipe) {
      setFilters(prev => ({ ...prev, equipe_id: primaryEquipe.equipe_id }));
    }
  }, [filters.visao, filters.equipe_id, primaryEquipe]);

  // Calcular dias baseado no período
  const periodoDias = (() => {
    if (filters.periodo === 'customizado' && filters.dataInicio && filters.dataFim) {
      const diffTime = Math.abs(filters.dataFim.getTime() - filters.dataInicio.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    switch (filters.periodo) {
      case 'hoje': return 1;
      case 'semana': return 7;
      case 'mes': return 30;
      case '90dias': return 90;
      default: return 1;
    }
  })();

  // Buscar dados com os filtros aplicados
  const { 
    kpis, 
    unitMetrics, 
    loading: metricsLoading,
    fetchKPIs,
    fetchUnitMetrics
  } = useDashboardMetrics();

  const { 
    teamMetrics, 
    loading: teamLoading,
    error: teamError,
    fetchTeamMetricsWithNames
  } = useTeamMetrics();

  // ✅ OTIMIZAÇÃO: Debounce para evitar múltiplas requisições simultâneas
  const debouncedFetchMetrics = useCallback(
    debounce(() => {
      console.log('📊 [DASHBOARD] Fetching metrics with filters:', { periodoDias, visao: filters.visao, unidade_id: filters.unidade_id });
      fetchKPIs({
        periodo_dias: periodoDias,
        unidade_filter: filters.visao === 'unidade' ? filters.unidade_id : undefined,
      });
      fetchUnitMetrics({
        periodo_dias: periodoDias,
      });
      fetchTeamMetricsWithNames({
        periodo_dias: periodoDias,
      });
    }, 500), // 500ms de debounce
    [periodoDias, filters.visao, filters.unidade_id]
  );

  // Recarregar métricas quando os filtros mudarem (com debounce)
  useEffect(() => {
    debouncedFetchMetrics();
  }, [periodoDias, filters.visao, filters.unidade_id]);

  const loading = metricsLoading || teamLoading;

  // Função de refresh global
  const handleRefresh = () => {
    fetchKPIs();
    fetchUnitMetrics();
    fetchTeamMetricsWithNames();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard de Governança</h1>
            <p className="text-muted-foreground">Carregando métricas...</p>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Preparar lista de equipes para o filtro
  const equipesParaFiltro = teamMetrics?.map(t => ({
    id: t.equipe_id || '',
    nome: t.equipe_nome || 'Equipe sem nome'
  })).filter(e => e.id) || [];

  // Preparar lista de unidades para o filtro
  const unidadesParaFiltro = unitMetrics?.map(u => ({
    id: u.unidade_id || '',
    nome: u.unidade_nome || 'Unidade sem nome'
  })).filter(u => u.id) || [];

  return (
    <div className="w-full space-y-4 md:space-y-6 pt-3 md:pt-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">Dashboard de Governança</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Visão completa de métricas e desempenho
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <DashboardFilters
        filters={filters}
        onChange={setFilters}
        equipes={equipesParaFiltro}
        unidades={unidadesParaFiltro}
        allowedViews={allowedViews as any}
      />

      {/* KPIs Principais */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-6">
        <KPICardWithTrend
          title="Total"
          value={kpis?.total_tickets || 0}
          icon={Ticket}
          iconColor="text-blue-500"
        />
        <KPICardWithTrend
          title="Resolvidos"
          value={kpis?.tickets_resolvidos || 0}
          icon={CheckCircle}
          iconColor="text-green-500"
          description={`de ${kpis?.total_tickets || 0} tickets`}
        />
        <KPICardWithTrend
          title="SLA"
          value={`${kpis?.percentual_sla || 0}%`}
          icon={Clock}
          iconColor={Number(kpis?.percentual_sla || 0) >= 85 ? 'text-green-500' : Number(kpis?.percentual_sla || 0) >= 70 ? 'text-yellow-500' : 'text-red-500'}
          description={(() => {
            const total = kpis?.total_tickets || 0;
            const slaOk = Math.round((Number(kpis?.percentual_sla || 0) / 100) * total);
            return `${slaOk} de ${total} no prazo`;
          })()}
        />
        <KPICardWithTrend
          title="Críticos"
          value={kpis?.tickets_crise || 0}
          icon={AlertTriangle}
          iconColor="text-red-500"
          description="requerem atenção"
        />
        <KPICardWithTrend
          title="Tempo Médio"
          value={(() => {
            const horas = Number(kpis?.tempo_medio_resolucao || 0);
            if (horas < 1) {
              const minutos = Math.round(horas * 60);
              return `${minutos} min`;
            } else if (horas < 24) {
              return `${horas.toFixed(1)}h`;
            } else {
              const dias = Math.floor(horas / 24);
              const horasRestantes = Math.round(horas % 24);
              return `${dias}d ${horasRestantes}h`;
            }
          })()}
          icon={Timer}
          iconColor="text-purple-500"
          description="para resolver"
        />
        <KPICardWithTrend
          title="Reabertos"
          value={kpis?.tickets_reabertos || 0}
          icon={TrendingUp}
          iconColor="text-orange-500"
          description={(() => {
            const total = kpis?.total_tickets || 0;
            const reabertos = kpis?.tickets_reabertos || 0;
            const percentual = total > 0 ? ((reabertos / total) * 100).toFixed(1) : '0';
            return `${percentual}% do total`;
          })()}
        />
      </div>

      {/* DETALHAMENTO POR VISÃO */}
      {filters.visao === 'geral' && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Métricas por Equipe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Desempenho por Equipe (Top 5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamMetrics && teamMetrics.length > 0 ? (
                  teamMetrics.slice(0, 5).map((team, index) => (
                    <div key={team.equipe_id || index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{team.equipe_nome || 'Equipe sem nome'}</p>
                        <p className="text-sm text-muted-foreground">
                          {team.total_tickets} tickets • {team.tickets_resolvidos} resolvidos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {team.tickets_sla_ok && team.total_tickets 
                            ? ((team.tickets_sla_ok / team.total_tickets) * 100).toFixed(1)
                            : '0.0'}%
                        </p>
                        <p className="text-xs text-muted-foreground">SLA</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma equipe com dados no período
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Métricas por Unidade */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Desempenho por Unidade (Top 5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {unitMetrics && unitMetrics.length > 0 ? (
                  unitMetrics.slice(0, 5).map((unit, index) => (
                    <div key={unit.unidade_id || index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{unit.unidade_nome || 'Unidade sem nome'}</p>
                        <p className="text-sm text-muted-foreground">
                          {unit.total_tickets_mes || 0} tickets • {unit.tickets_resolvidos || 0} resolvidos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {Number(unit.percentual_sla || 0).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">SLA</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma unidade com dados no período
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {filters.visao === 'equipe' && filters.equipe_id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Detalhes da Equipe Selecionada
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const equipeData = teamMetrics?.find(t => t.equipe_id === filters.equipe_id);
              if (!equipeData) {
                return <p className="text-sm text-muted-foreground">Equipe não encontrada</p>;
              }
              return (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total de Tickets</p>
                      <p className="text-2xl font-bold">{equipeData.total_tickets}</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Resolvidos</p>
                      <p className="text-2xl font-bold text-success">{equipeData.tickets_resolvidos}</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">SLA Compliance</p>
                      <p className="text-2xl font-bold text-primary">
                        {equipeData.tickets_sla_ok && equipeData.total_tickets
                          ? ((equipeData.tickets_sla_ok / equipeData.total_tickets) * 100).toFixed(1)
                          : '0.0'}%
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Internal Alerts Panel */}
      <InternalAlertsPanel />
    </div>
  );
};

export default Dashboard;
