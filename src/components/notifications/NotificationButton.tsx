import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Clock, CheckCircle, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useInternalAlerts } from '@/hooks/useInternalAlerts';
import { NotificationSounds } from '@/lib/notification-sounds';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const NotificationButton = ({ isExpanded = false }: { isExpanded?: boolean }) => {
  const navigate = useNavigate();
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
      case 'internal_access_request': return 'Solicitação de Acesso';
      default: return type.replace('_', ' ');
    }
  };

  const formatTicketCode = (ticketId: string | null) => {
    if (!ticketId) return 'SISTEMA';
    return ticketId.slice(0, 8).toUpperCase();
  };

  if (loading) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        disabled 
        className="text-white hover:bg-white/5 hover:backdrop-blur-sm transition-all duration-450"
      >
        <Bell className="h-4 w-4 opacity-90" />
        {isExpanded && <span className="ml-2 text-sm drop-shadow-md">Notificações</span>}
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`relative transition-all duration-450 hover:scale-[1.02] ${
            isExpanded 
              ? "flex items-center px-3 py-2 rounded-xl hover:bg-white/5 hover:backdrop-blur-sm hover:text-white/95 hover:border hover:border-white/10 text-white w-full justify-start"
              : "w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl hover:bg-white/5 hover:backdrop-blur-sm hover:text-white/95 text-white mx-auto"
          }`}
        >
          <Bell className={`${isExpanded ? 'h-4 w-4 mr-2' : 'h-3 w-3 sm:h-4 sm:w-4'} text-white opacity-90 drop-shadow-md`} />
          {isExpanded && <span className="text-sm font-medium drop-shadow-md">Notificações</span>}
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
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Notificações</h4>
              <p className="text-sm text-muted-foreground">
                {alerts.length} {alerts.length === 1 ? 'alerta pendente' : 'alertas pendentes'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                NotificationSounds.requestAudioPermission().then(() => {
                  NotificationSounds.playNotificationSound('info');
                });
              }}
              className="h-8 w-8 p-0"
              title="Testar som das notificações"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
          </div>
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
                        {alert.ticket_id ? (
                          <>
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
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-muted px-1 rounded">
                              #SISTEMA
                            </span>
                            <span>
                              {formatDistanceToNow(new Date(alert.created_at), {
                                addSuffix: true,
                                locale: ptBR
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {alert.ticket_id ? (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs"
                            onClick={() => {
                              console.log('Ver Ticket clicked! Alert:', alert);
                              console.log('Ticket ID:', alert.ticket_id);
                              setOpen(false);
                              
                              // Check if we're on the tickets page
                              const currentPath = window.location.pathname;
                              console.log('Current path:', currentPath);
                              
                              if (currentPath === '/admin/tickets') {
                                // Dispatch event to open ticket modal on tickets page
                                console.log('Dispatching openTicketModal event with ticketId:', alert.ticket_id);
                                const event = new CustomEvent('openTicketModal', { 
                                  detail: { ticketId: alert.ticket_id }
                                });
                                window.dispatchEvent(event);
                                console.log('Event dispatched!');
                              } else if (currentPath === '/admin') {
                                // Dispatch event to open ticket modal on dashboard
                                console.log('Dispatching openTicketModal event on dashboard with ticketId:', alert.ticket_id);
                                const event = new CustomEvent('openTicketModal', { 
                                  detail: { ticketId: alert.ticket_id }
                                });
                                window.dispatchEvent(event);
                                console.log('Event dispatched!');
                              } else {
                                // Navigate to tickets page with ticket parameter
                                console.log('Navigating to tickets page with ticket:', alert.ticket_id);
                                window.location.href = `/admin/tickets?ticket=${alert.ticket_id}`;
                              }
                            }}
                          >
                            Ver Ticket
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs"
                            onClick={() => {
                              setOpen(false);
                              navigate('/admin');
                            }}
                          >
                            Ver Painel
                          </Button>
                        )}
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
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full" 
                onClick={() => {
                  setOpen(false);
                  navigate('/admin');
                }}
              >
                Ver Todos os Alertas
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};