
import { AlertTriangle, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSLAMonitor } from '@/hooks/useSLAMonitor';
import { cn } from '@/lib/utils';

export const SLAAlerts = () => {
  const { slaAlerts, loading } = useSLAMonitor();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Monitor SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando alertas...</p>
        </CardContent>
      </Card>
    );
  }

  if (slaAlerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-500" />
            Monitor SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-600">✅ Todos os SLAs dentro do prazo</p>
        </CardContent>
      </Card>
    );
  }

  const overdueAlerts = slaAlerts.filter(alert => alert.is_overdue);
  const criticalAlerts = slaAlerts.filter(alert => !alert.is_overdue && alert.sla_percentage >= 80);
  const warningAlerts = slaAlerts.filter(alert => !alert.is_overdue && alert.sla_percentage < 80);

  return (
    <Card className={cn(
      "border-l-4",
      overdueAlerts.length > 0 ? "border-l-red-500" : 
      criticalAlerts.length > 0 ? "border-l-orange-500" : "border-l-yellow-500"
    )}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {overdueAlerts.length > 0 ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : (
            <Clock className="h-4 w-4 text-orange-500" />
          )}
          Alertas SLA
          <Badge variant={overdueAlerts.length > 0 ? "destructive" : "secondary"}>
            {slaAlerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* SLAs Vencidos */}
        {overdueAlerts.map(alert => (
          <div key={alert.ticketId} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-red-500" />
              <span className="font-mono text-sm font-medium">{alert.codigo_ticket}</span>
              <Badge variant="destructive" className="text-xs">
                {alert.prioridade}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-red-600">
                VENCIDO
              </p>
              <p className="text-xs text-red-500">
                há {Math.abs(alert.minutes_remaining)} min
              </p>
            </div>
          </div>
        ))}

        {/* SLAs Críticos (80-99%) */}
        {criticalAlerts.map(alert => (
          <div key={alert.ticketId} className="flex items-center justify-between p-2 bg-orange-50 border border-orange-200 rounded">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="font-mono text-sm font-medium">{alert.codigo_ticket}</span>
              <Badge variant="outline" className="text-xs">
                {alert.prioridade}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-orange-600">
                {alert.sla_percentage}%
              </p>
              <p className="text-xs text-orange-500">
                {alert.minutes_remaining} min restantes
              </p>
            </div>
          </div>
        ))}

        {/* SLAs em Alerta (50-79%) */}
        {warningAlerts.map(alert => (
          <div key={alert.ticketId} className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="font-mono text-sm font-medium">{alert.codigo_ticket}</span>
              <Badge variant="secondary" className="text-xs">
                {alert.prioridade}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-yellow-600">
                {alert.sla_percentage}%
              </p>
              <p className="text-xs text-yellow-500">
                {alert.minutes_remaining} min restantes
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
