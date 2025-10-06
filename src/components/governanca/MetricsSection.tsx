
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Building, AlertCircle, BarChart3 } from "lucide-react";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useTeamMetrics } from "@/hooks/useTeamMetrics";
import { EmptyState } from "./EmptyState";

interface MetricsSectionProps {
  periodDays?: number;
}

export function MetricsSection({ periodDays = 30 }: MetricsSectionProps) {
  const { 
    unitMetrics, 
    loading: unitLoading, 
    fetchUnitMetrics 
  } = useDashboardMetrics();
  
  const {
    teamMetrics,
    loading: teamLoading,
    fetchTeamMetricsWithNames
  } = useTeamMetrics();
  
  const [refreshing, setRefreshing] = useState(false);

  // Log para debugar o estado das métricas
  useEffect(() => {
    console.log('🏢 [METRICS SECTION] Unit metrics state changed:', {
      unitMetrics,
      length: unitMetrics?.length,
      loading: unitLoading,
      sample: unitMetrics?.[0]
    });
  }, [unitMetrics, unitLoading]);

  useEffect(() => {
    console.log('👥 [METRICS SECTION] Team metrics state changed:', {
      teamMetrics,
      length: teamMetrics?.length,
      loading: teamLoading,
      sample: teamMetrics?.[0]
    });
  }, [teamMetrics, teamLoading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Use a very large period (999 days) when periodDays is 0 (means "all")
      const actualPeriod = periodDays === 0 ? 999 : periodDays;
      console.log('🔄 [METRICS] Refreshing with period:', { periodDays, actualPeriod });
      
      // Show toast on manual refresh
      await Promise.all([
        fetchTeamMetricsWithNames({ periodo_dias: actualPeriod }),
        fetchUnitMetrics({ periodo_dias: actualPeriod }, true)
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Update data when period changes
  useEffect(() => {
    const actualPeriod = periodDays === 0 ? 999 : periodDays;
    console.log('🔄 [METRICS] Period changed, fetching with:', { periodDays, actualPeriod });
    
    // Don't show toast on automatic load
    fetchUnitMetrics({ periodo_dias: actualPeriod }, false);
    fetchTeamMetricsWithNames({ periodo_dias: actualPeriod });
  }, [periodDays, fetchUnitMetrics, fetchTeamMetricsWithNames]);

  const loading = unitLoading || teamLoading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Team Metrics */}
      <Card className="liquid-glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Métricas das Equipes</span>
              </CardTitle>
              <CardDescription>
                Performance e estatísticas por equipe
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {teamLoading && (!teamMetrics || teamMetrics.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                Carregando métricas das equipes...
              </p>
            </div>
          ) : !teamMetrics || teamMetrics.length === 0 ? (
            <EmptyState
              type="no-tickets"
              title="Nenhum ticket de equipe encontrado"
              description={`Não há atividade de tickets nas equipes ${periodDays === 0 ? 'em todo o histórico' : periodDays === 1 ? 'hoje' : `nos últimos ${periodDays} dias`}. As métricas de equipes serão exibidas quando houver tickets atribuídos a equipes.`}
              icon={<Users className="h-10 w-10 text-muted-foreground" />}
              hint="🎯 As métricas de equipe rastreiam tickets atribuídos, resolução, SLA e tickets de crise por equipe"
              action={{
                label: "Ver Todos os Períodos",
                onClick: () => window.location.href = '/admin/tickets'
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground mb-2">
                👥 {teamMetrics.length} equipes carregadas
              </div>
              {teamMetrics.slice(0, 5).map((team, index) => {
                const slaPercentage = team.total_tickets > 0 
                  ? (team.tickets_sla_ok / team.total_tickets * 100) 
                  : 0;

                return (
                  <div key={team.equipe_id} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate">
                          {team.equipe_nome}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {team.total_tickets} tickets • {team.tickets_resolvidos} resolvidos
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          slaPercentage >= 80 ? "default" : 
                          slaPercentage >= 60 ? "secondary" : 
                          "destructive"
                        }>
                          {slaPercentage.toFixed(1)}% SLA
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Tempo médio</p>
                        <p className="font-medium">
                          {(team.tempo_medio_resolucao || 0).toFixed(1)}h
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tickets crise</p>
                        <p className="font-medium">{team.tickets_crise || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Unidades</p>
                        <p className="font-medium">{team.unidades_atendidas || 0}</p>
                      </div>
                    </div>

                    {/* Progress bar for resolution rate */}
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">Taxa de resolução</span>
                        <span className="text-xs font-medium">
                          {team.total_tickets > 0 
                            ? ((team.tickets_resolvidos / team.total_tickets) * 100).toFixed(1)
                            : 0
                          }%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div 
                          className="h-1.5 rounded-full bg-primary"
                          style={{ 
                            width: `${team.total_tickets > 0 
                              ? (team.tickets_resolvidos / team.total_tickets) * 100 
                              : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {teamMetrics.length > 5 && (
                <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground">
                    E mais {teamMetrics.length - 5} equipes...
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unit Metrics */}
      <Card className="liquid-glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>Métricas das Unidades</span>
              </CardTitle>
              <CardDescription>
                Performance e estatísticas por unidade
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {unitLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                Carregando métricas das unidades...
              </p>
            </div>
          ) : !unitMetrics || unitMetrics.length === 0 ? (
            <EmptyState
              type="no-tickets"
              title="Nenhum ticket de unidade encontrado"
              description={`Não há atividade de tickets nas unidades ${periodDays === 0 ? 'em todo o histórico' : periodDays === 1 ? 'hoje' : `nos últimos ${periodDays} dias`}. As métricas de unidades aparecerão quando houver tickets criados para unidades específicas.`}
              icon={<Building className="h-10 w-10 text-muted-foreground" />}
              hint="🏢 As métricas de unidade mostram performance de tickets, SLA e resolução por unidade organizacional"
              action={{
                label: "Criar Ticket de Teste",
                onClick: () => window.location.href = '/admin/tickets'
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground mb-2">
                📊 {unitMetrics.length} unidades carregadas
              </div>
              {unitMetrics.slice(0, 5).map((unit, index) => (
                <div key={unit.unidade_id} className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate">
                        {unit.unidade_nome}
                      </h4>
                       <p className="text-xs text-muted-foreground">
                         {unit.total_tickets_mes || 0} tickets • {unit.tickets_resolvidos || 0} resolvidos
                       </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={
                        (unit.percentual_sla || 0) >= 80 ? "default" : 
                        (unit.percentual_sla || 0) >= 60 ? "secondary" : 
                        "destructive"
                      }>
                        {(unit.percentual_sla || 0).toFixed(1)}% SLA
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Tempo médio</p>
                      <p className="font-medium">
                        {unit.tempo_medio_resolucao?.toFixed(1) || '0'}h
                      </p>
                    </div>
                     <div>
                       <p className="text-muted-foreground">Tickets crise</p>
                       <p className="font-medium">{unit.tickets_crise || 0}</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground">IA sucesso</p>
                       <p className="font-medium">{unit.ia_bem_sucedida || 0}</p>
                     </div>
                  </div>

                  {/* Progress bar for resolution rate */}
                  <div className="mt-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-muted-foreground">Taxa de resolução</span>
                       <span className="text-xs font-medium">
                         {(unit.total_tickets_mes || 0) > 0 
                           ? (((unit.tickets_resolvidos || 0) / (unit.total_tickets_mes || 1)) * 100).toFixed(1)
                           : '0'
                         }%
                       </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div 
                        className="h-1.5 rounded-full bg-primary"
                         style={{ 
                           width: `${(unit.total_tickets_mes || 0) > 0 
                             ? ((unit.tickets_resolvidos || 0) / (unit.total_tickets_mes || 1)) * 100 
                             : 0
                           }%`
                         }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {unitMetrics.length > 5 && (
                <div className="text-center pt-2">
                  <p className="text-xs text-muted-foreground">
                    E mais {unitMetrics.length - 5} unidades...
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
