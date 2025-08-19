import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useInternalAlerts } from '@/hooks/useInternalAlerts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AlertsPanel = () => {
  const { alerts, loading, markAlertAsProcessed } = useInternalAlerts();
  const [processingAlerts, setProcessingAlerts] = useState<Set<string>>(new Set());

  const getAlertLevelBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Crítico
        </Badge>;
      case 'warning':
        return <Badge variant="default" className="bg-orange-100 text-orange-800 gap-1">
          <Clock className="h-3 w-3" />
          Aviso
        </Badge>;
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'ia_escalation_crisis': return 'IA Escalou Ticket de Crise';
      case 'delete_resolved_ticket': return 'Tentativa de Apagar Ticket Resolvido';
      case 'unauthorized_unit_access': return 'Acesso Não Autorizado à Unidade';
      case 'critical_ai_response': return 'IA Respondeu Conteúdo Crítico';
      case 'sla_critical_breach': return 'SLA Crítico Vencido';
      default: return type;
    }
  };

  const handleMarkAsProcessed = async (alertId: string) => {
    setProcessingAlerts(prev => new Set(prev).add(alertId));
    try {
      await markAlertAsProcessed(alertId);
    } finally {
      setProcessingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertas Internos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Carregando alertas...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alertas Internos ({alerts.length})
        </CardTitle>
        <CardDescription>
          Alertas automáticos de segurança e conformidade
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum alerta pendente</p>
            <p className="text-sm">Sistema funcionando normalmente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getAlertLevelBadge(alert.alert_level)}
                      {alert.alert_category && (
                        <Badge variant="outline">{alert.alert_category}</Badge>
                      )}
                    </div>
                    <h4 className="font-medium">{getAlertTypeLabel(alert.type)}</h4>
                    <div className="text-sm text-muted-foreground mt-1">
                      <p>Ticket: {alert.ticket_id.slice(0, 8)}...</p>
                      <p>
                        {formatDistanceToNow(new Date(alert.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </p>
                    </div>
                    
                    {alert.payload && Object.keys(alert.payload).length > 0 && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <pre className="overflow-x-auto">
                          {JSON.stringify(alert.payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                    >
                      <Link to={`/admin/tickets?ticket=${alert.ticket_id}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                    
                    <Button
                      onClick={() => handleMarkAsProcessed(alert.id)}
                      disabled={processingAlerts.has(alert.id)}
                      size="sm"
                      variant="outline"
                    >
                      {processingAlerts.has(alert.id) ? (
                        "Processando..."
                      ) : (
                        "Marcar como Processado"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};