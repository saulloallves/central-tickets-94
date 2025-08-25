import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, BarChart3, Users, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useFranqueadoUnits } from '@/hooks/useFranqueadoUnits';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface UnitKPIs {
  total_tickets: number;
  tickets_abertos: number;
  tickets_resolvidos: number;
  tickets_crise: number;
  percentual_sla: number;
  percentual_resolucao: number;
  tempo_medio_resolucao: number;
}

export default function FranqueadoUnidades() {
  const { units, loading } = useFranqueadoUnits();
  const navigate = useNavigate();
  const [unitsKPIs, setUnitsKPIs] = useState<Record<string, UnitKPIs>>({});
  const [loadingKPIs, setLoadingKPIs] = useState(false);

  // Buscar KPIs de cada unidade
  useEffect(() => {
    const fetchKPIs = async () => {
      if (units.length === 0) return;

      setLoadingKPIs(true);
      const kpisMap: Record<string, UnitKPIs> = {};

      try {
        for (const unit of units) {
          const { data, error } = await supabase.rpc('get_realtime_kpis', {
            p_unidade_filter: unit.id,
            p_periodo_dias: 30
          });

          if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
            kpisMap[unit.id] = data as unknown as UnitKPIs;
          } else {
            // KPIs padrão se erro
            kpisMap[unit.id] = {
              total_tickets: 0,
              tickets_abertos: 0,
              tickets_resolvidos: 0,
              tickets_crise: 0,
              percentual_sla: 0,
              percentual_resolucao: 0,
              tempo_medio_resolucao: 0
            };
          }
        }

        setUnitsKPIs(kpisMap);
      } catch (error) {
        console.error('Erro ao buscar KPIs das unidades:', error);
      } finally {
        setLoadingKPIs(false);
      }
    };

    fetchKPIs();
  }, [units]);

  const handleViewTickets = (unitId: string) => {
    navigate(`/franqueado/tickets?unidade=${unitId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando unidades...</p>
        </div>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Nenhuma unidade encontrada</h3>
          <p className="text-muted-foreground">
            Você não possui unidades vinculadas ao seu perfil.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold">Minhas Unidades</h1>
        <p className="text-muted-foreground">
          Acompanhe o desempenho de suas {units.length} unidades
        </p>
      </div>

      {/* Grid de Unidades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {units.map((unit) => {
          const kpis = unitsKPIs[unit.id];
          const isLoadingKPI = loadingKPIs || !kpis;

          return (
            <Card key={unit.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{unit.grupo}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {unit.cidade} - {unit.uf}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewTickets(unit.id)}
                  >
                    Ver Tickets
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {isLoadingKPI ? (
                  <div className="text-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Carregando métricas...</p>
                  </div>
                ) : (
                  <>
                    {/* Resumo Rápido */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">{kpis.total_tickets}</div>
                        <div className="text-xs text-muted-foreground">Total Tickets</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{kpis.tickets_resolvidos}</div>
                        <div className="text-xs text-muted-foreground">Resolvidos</div>
                      </div>
                    </div>

                    {/* KPIs Detalhados */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-blue-500" />
                          <span className="text-sm">Tickets Abertos</span>
                        </div>
                        <Badge variant={kpis.tickets_abertos > 10 ? "destructive" : "secondary"}>
                          {kpis.tickets_abertos}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">SLA Cumprido</span>
                        </div>
                        <Badge variant={kpis.percentual_sla >= 80 ? "default" : "destructive"}>
                          {kpis.percentual_sla.toFixed(1)}%
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <span className="text-sm">Tempo Médio</span>
                        </div>
                        <Badge variant="outline">
                          {kpis.tempo_medio_resolucao.toFixed(1)}h
                        </Badge>
                      </div>

                      {kpis.tickets_crise > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm">Tickets Crise</span>
                          </div>
                          <Badge variant="destructive">
                            {kpis.tickets_crise}
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-purple-500" />
                          <span className="text-sm">Taxa Resolução</span>
                        </div>
                        <Badge variant={kpis.percentual_resolucao >= 90 ? "default" : "secondary"}>
                          {kpis.percentual_resolucao.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumo Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {Object.values(unitsKPIs).reduce((sum, kpi) => sum + kpi.total_tickets, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total de Tickets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(unitsKPIs).reduce((sum, kpi) => sum + kpi.tickets_resolvidos, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Tickets Resolvidos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">
                {Object.values(unitsKPIs).reduce((sum, kpi) => sum + kpi.tickets_abertos, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Tickets Abertos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {Object.values(unitsKPIs).reduce((sum, kpi) => sum + kpi.tickets_crise, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Tickets Crise</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}