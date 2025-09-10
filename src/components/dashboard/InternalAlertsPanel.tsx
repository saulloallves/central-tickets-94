import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useInternalNotifications } from '@/hooks/useInternalNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Bell, 
  CheckCircle, 
  Clock, 
  ExternalLink, 
  AlertTriangle,
  Ticket,
  Info,
  CheckCheck,
  Eye
} from 'lucide-react';

export const InternalAlertsPanel = () => {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAllAsRead 
  } = useInternalNotifications();
  
  const [processingNotifications, setProcessingNotifications] = useState<Set<string>>(new Set());
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ticket':
        return <Ticket className="h-4 w-4" />;
      case 'sla':
        return <Clock className="h-4 w-4" />;
      case 'alert':
      case 'crisis':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'crisis':
        return <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Crise
        </Badge>;
      case 'sla':
        return <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          SLA
        </Badge>;
      case 'ticket':
        return <Badge variant="default" className="gap-1">
          <Ticket className="h-3 w-3" />
          Ticket
        </Badge>;
      case 'alert':
        return <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Alerta
        </Badge>;
      default:
        return <Badge variant="outline" className="gap-1">
          <Info className="h-3 w-3" />
          Info
        </Badge>;
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    setProcessingNotifications(prev => new Set(prev).add(notificationId));
    try {
      await markAsRead(notificationId);
    } finally {
      setProcessingNotifications(prev => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    setMarkingAllAsRead(true);
    try {
      await markAllAsRead();
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  if (isLoading) {
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Alertas Internos
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Notificações do sistema e alertas de equipe
            </CardDescription>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={handleMarkAllAsRead}
              disabled={markingAllAsRead}
              size="sm"
              variant="outline"
              className="gap-1"
            >
              <CheckCheck className="h-4 w-4" />
              {markingAllAsRead ? "Marcando..." : "Marcar todas como lidas"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhuma notificação</p>
            <p className="text-sm">Você está em dia!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {notifications.slice(0, 10).map((notification) => {
              const isRead = notification.recipient_status?.is_read;
              
              return (
                <div 
                  key={notification.id} 
                  className={`border rounded-lg p-3 transition-all hover:shadow-sm ${
                    isRead 
                      ? 'bg-muted/30 border-border' 
                      : 'bg-background border-primary/20 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-full ${
                        isRead ? 'bg-muted' : 'bg-primary/10'
                      }`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-medium text-sm truncate ${
                            isRead ? 'text-muted-foreground' : 'text-foreground'
                          }`}>
                            {notification.title}
                          </h4>
                          {getNotificationBadge(notification.type)}
                        </div>
                        
                        {notification.equipe?.nome && (
                          <Badge variant="outline" className="text-xs mb-2">
                            {notification.equipe.nome}
                          </Badge>
                        )}
                        
                        {notification.message && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {notification.message}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                          {isRead && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                Lida
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {notification.payload?.ticket_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('openTicketModal', { 
                              detail: { ticketId: notification.payload.ticket_id }
                            }));
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      
                      {!isRead && (
                        <Button
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={processingNotifications.has(notification.id)}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                        >
                          {processingNotifications.has(notification.id) ? (
                            "..."
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {notifications.length > 10 && (
              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground">
                  Mostrando 10 de {notifications.length} notificações
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};