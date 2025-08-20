import { useState } from 'react';
import { Bell, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useInternalAlerts } from '@/hooks/useInternalAlerts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export const NotificationButton = () => {
  const { alerts, loading, markAlertAsProcessed } = useInternalAlerts();
  const [open, setOpen] = useState(false);

  const getAlertIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <AlertTriangle className="h-3 w-3 text-critical" />;
      case 'warning':
        return <Clock className="h-3 w-3 text-warning" />;
      default:
        return <CheckCircle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case 'sla_breach': return 'SLA Vencido';
      case 'sla_half': return 'SLA 50%';
      case 'ia_escalation_crisis': return 'IA Escalou Crise';
      case 'critical_ai_response': return 'IA Resposta Crítica';
      default: return type.replace('_', ' ');
    }
  };

  const formatTicketCode = (ticketId: string) => {
    return ticketId.slice(0, 8).toUpperCase();
  };

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Bell className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {alerts.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {alerts.length > 9 ? '9+' : alerts.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 pb-0">
          <h4 className="font-semibold">Notificações</h4>
          <p className="text-sm text-muted-foreground">
            {alerts.length} {alerts.length === 1 ? 'alerta pendente' : 'alertas pendentes'}
          </p>
        </div>
        
        <Separator className="my-2" />
        
        <ScrollArea className="max-h-80">
          {alerts.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="space-y-1">
              {alerts.slice(0, 10).map((alert) => (
                <div 
                  key={alert.id}
                  className="p-3 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getAlertIcon(alert.alert_level)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {getAlertTypeLabel(alert.type)}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {alert.alert_level === 'critical' ? 'Crítico' : 
                           alert.alert_level === 'warning' ? 'Aviso' : 'Normal'}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-muted px-1 rounded">
                            #{formatTicketCode(alert.ticket_id)}
                          </span>
                          <span>
                            {formatDistanceToNow(new Date(alert.created_at), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                        </div>
                        
                        {/* Mostrar título do ticket em vez do ID */}
                        <div className="text-xs">
                          <span className="text-primary font-medium">
                            {alert.tickets?.titulo || alert.tickets?.descricao_problema || 
                             alert.payload?.codigo_ticket || 'Ticket sem título'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs"
                          onClick={() => {
                            setOpen(false);
                            // Dispatch event to open ticket modal
                            window.dispatchEvent(new CustomEvent('openTicketModal', { 
                              detail: { ticketId: alert.ticket_id }
                            }));
                          }}
                        >
                          Ver Ticket
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs"
                          onClick={() => markAlertAsProcessed(alert.id)}
                        >
                          Marcar Lido
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {alerts.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="p-3">
              <Link to="/admin" onClick={() => setOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  Ver Todos os Alertas
                </Button>
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};