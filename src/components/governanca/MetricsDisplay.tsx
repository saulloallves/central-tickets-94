import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Building, AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { useDashboardMetrics, TeamMetrics, UnitMetrics } from "@/hooks/useDashboardMetrics";
import { EmptyState } from "./EmptyState";

interface MetricsDisplayProps {
  title: string;
  description: string;
  type: 'team' | 'unit';
  data: TeamMetrics[] | UnitMetrics[];
  loading: boolean;
  onRefresh: () => void;
  error?: boolean;
}

export function MetricsDisplay({
  title,
  description,
  type,
  data,
  loading,
  onRefresh,
  error = false
}: MetricsDisplayProps) {
  const icon = type === 'team' ? Users : Building;
  const IconComponent = icon;

  if (error) {
    return (
      <Card className="liquid-glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <IconComponent className="h-5 w-5" />
                <span>{title}</span>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button
              onClick={onRefresh}
              disabled={loading}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h4 className="text-lg font-semibold text-foreground mb-2">
              Erro ao carregar métricas
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Não foi possível carregar os dados das {type === 'team' ? 'equipes' : 'unidades'}. 
              Verifique sua conexão e tente novamente.
            </p>
            <Button onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="liquid-glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <IconComponent className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">
              Carregando métricas das {type === 'team' ? 'equipes' : 'unidades'}...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="liquid-glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <IconComponent className="h-5 w-5" />
                <span>{title}</span>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Button
              onClick={onRefresh}
              disabled={loading}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <IconComponent className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-semibold text-foreground mb-2">
              Sem dados disponíveis
            </h4>
            <p className="text-sm text-muted-foreground">
              Não há métricas de {type === 'team' ? 'equipes' : 'unidades'} para exibir no momento.
              Isso pode acontecer se não houver tickets no período selecionado.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="liquid-glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <IconComponent className="h-5 w-5" />
              <span>{title}</span>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            onClick={onRefresh}
            disabled={loading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => {
            const isTeam = type === 'team';
            const name = isTeam 
              ? (item as TeamMetrics).equipe_nome 
              : (item as UnitMetrics).unidade_nome;
            const totalTickets = isTeam 
              ? (item as TeamMetrics).total_tickets 
              : (item as UnitMetrics).total_tickets_mes;
            const resolvedTickets = isTeam 
              ? (item as TeamMetrics).tickets_resolvidos 
              : (item as UnitMetrics).tickets_resolvidos;
            const slaPercentage = isTeam 
              ? ((item as TeamMetrics).tickets_sla_ok / totalTickets * 100) 
              : (item as UnitMetrics).percentual_sla;

            return (
              <div key={index} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold truncate">{name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {totalTickets} tickets • {resolvedTickets} resolvidos
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={slaPercentage >= 80 ? "default" : slaPercentage >= 60 ? "secondary" : "destructive"}>
                      {slaPercentage.toFixed(1)}% SLA
                    </Badge>
                    {slaPercentage >= 80 ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-warning" />
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-muted-foreground">Tempo médio resolução</p>
                    <p className="font-medium">
                      {isTeam 
                        ? (item as TeamMetrics).tempo_medio_resolucao.toFixed(1) 
                        : (item as UnitMetrics).tempo_medio_resolucao.toFixed(1)
                      }h
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {isTeam ? 'Tickets crise' : 'IA sucesso'}
                    </p>
                    <p className="font-medium">
                      {isTeam 
                        ? (item as TeamMetrics).tickets_crise
                        : (item as UnitMetrics).ia_bem_sucedida
                      }
                    </p>
                  </div>
                </div>

                {/* Progress bar for resolution rate */}
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">Taxa de resolução</span>
                    <span className="text-xs font-medium">
                      {((resolvedTickets / totalTickets) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div 
                      className="h-1.5 rounded-full bg-primary"
                      style={{ 
                        width: `${(resolvedTickets / totalTickets) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}