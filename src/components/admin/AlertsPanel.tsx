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
        return <Badge variant="critical" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Crítico
        </Badge>;
      case 'warning':
        return <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" />
          Aviso
        </Badge>;
      default:
        return <Badge variant="info" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Normal
        </Badge>;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'sla_breach': return 'SLA Vencido';
      case 'sla_half': return 'SLA 50% do Prazo';
      case 'ia_escalation_crisis': return 'IA Escalou Ticket de Crise';
      case 'delete_resolved_ticket': return 'Tentativa de Apagar Ticket Resolvido';
      case 'unauthorized_unit_access': return 'Acesso Não Autorizado à Unidade';
      case 'critical_ai_response': return 'IA Respondeu Conteúdo Crítico';
      case 'sla_critical_breach': return 'SLA Crítico Vencido';
      default: return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const formatTicketCode = (ticketId: string) => {
    return ticketId.slice(0, 8).toUpperCase();
  };

  const formatAlertPayload = (payload: any) => {
    if (!payload || Object.keys(payload).length === 0) return null;
    
    return (
      <div className="mt-3 space-y-2">
        {payload.codigo_ticket && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Código:</span>
            <Badge variant="outline" className="font-mono text-xs">
              {payload.codigo_ticket}
            </Badge>
          </div>
        )}
        {payload.unidade_id && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Unidade:</span>
            <span className="text-xs text-muted-foreground font-mono">
              {payload.unidade_id.slice(0, 8)}...
            </span>
          </div>
        )}
        {payload.user_id && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Usuário:</span>
            <span className="text-xs text-muted-foreground font-mono">
              {payload.user_id.slice(0, 8)}...
            </span>
          </div>
        )}
      </div>
    );
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
          <AlertTriangle className="h-5 w-5 text-warning" />
          Alertas Internos ({alerts.length})
        </CardTitle>
        <CardDescription>
          Alertas automáticos de segurança e conformidade
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
            <p>Nenhum alerta pendente</p>
            <p className="text-sm">Sistema funcionando normalmente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => {
              const getBorderColor = () => {
                switch (alert.alert_level) {
                  case 'critical': return 'border-l-4 border-l-critical bg-critical/5';
                  case 'warning': return 'border-l-4 border-l-warning bg-warning/5';
                  default: return 'border-l-4 border-l-info bg-info/5';
                }
              };
              
              return (
              <div 
                key={alert.id} 
                className={`border rounded-lg p-4 space-y-3 hover:shadow-card transition-all ${getBorderColor()}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getAlertLevelBadge(alert.alert_level)}
                      {alert.alert_category && (
                        <Badge variant="outline">{alert.alert_category}</Badge>
                      )}
                    </div>
                    <h4 className="font-medium text-base">{getAlertTypeLabel(alert.type)}</h4>
                    
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Ticket:</span>
                        <Badge variant="outline" className="font-mono">
                          #{formatTicketCode(alert.ticket_id)}
                        </Badge>
                      </div>
                      <span>
                        {formatDistanceToNow(new Date(alert.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    </div>
                    
                    {formatAlertPayload(alert.payload)}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="text-info hover:text-info"
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
                      className="text-success border-success hover:bg-success hover:text-success-foreground"
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};