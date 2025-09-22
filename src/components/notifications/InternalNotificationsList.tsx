import { Bell, Check, CheckCheck, Clock, AlertTriangle, Info, Ticket, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInternalNotifications, InternalNotification } from '@/hooks/useInternalNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'ticket':
      return <Ticket className="h-4 w-4" />;
    case 'sla':
      return <Clock className="h-4 w-4" />;
    case 'alert':
    case 'crisis':
      return <AlertTriangle className="h-4 w-4" />;
    case 'franqueado_respondeu':
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
};

const getNotificationVariant = (type: string) => {
  switch (type) {
    case 'crisis':
      return 'destructive';
    case 'alert':
    case 'sla':
      return 'secondary';
    case 'ticket':
      return 'default';
    case 'franqueado_respondeu':
      return 'default';
    default:
      return 'outline';
  }
};

interface NotificationItemProps {
  notification: InternalNotification;
  onMarkAsRead: (id: string) => void;
}

const NotificationItem = ({ notification, onMarkAsRead }: NotificationItemProps) => {
  const isRead = notification.recipient_status?.is_read;

  return (
    <div 
      className={`p-4 border rounded-lg transition-colors ${
        isRead ? 'bg-muted/30' : 'bg-background border-primary/20'
      }`}
    >
      <div className="flex items-start justify-between space-x-3">
        <div className="flex items-start space-x-3 flex-1">
          <div className={`p-2 rounded-full ${isRead ? 'bg-muted' : 'bg-primary/10'}`}>
            {getNotificationIcon(notification.type)}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center space-x-2">
              <h4 className={`font-medium ${isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                {notification.title}
              </h4>
              <Badge variant={getNotificationVariant(notification.type)}>
                {notification.type}
              </Badge>
              {notification.equipe?.nome && (
                <Badge variant="outline">
                  {notification.equipe.nome}
                </Badge>
              )}
            </div>
            
            {notification.message && (
              <p className={`text-sm ${isRead ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                {notification.message}
              </p>
            )}
            
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>
                {formatDistanceToNow(new Date(notification.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
              {isRead && (
                <>
                  <span>•</span>
                  <span>Lida</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {!isRead && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMarkAsRead(notification.id)}
            className="shrink-0"
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export const InternalNotificationsList = () => {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, forceSync } = useInternalNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: InternalNotification) => {
    // Extract ticket ID from payload or message
    const ticketId = notification.payload?.ticket_id || 
                     notification.payload?.ticketId ||
                     notification.message?.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/)?.[0];
    
    if (ticketId) {
      // Mark as read if not already
      if (!notification.recipient_status?.is_read) {
        markAsRead(notification.id);
      }
      
      // For ticket-related notifications, navigate to tickets page and open modal
      if (notification.type === 'ticket' || notification.type === 'franqueado_respondeu' || notification.type === 'sla') {
        // Always navigate to tickets page
        navigate(`/admin/tickets?ticket=${ticketId}`);
        
        // Also dispatch event to open modal
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openTicketModal', {
            detail: { ticketId }
          }));
        }, 100);
      } else {
        // For other notifications, navigate normally
        navigate(`/admin/tickets?ticket=${ticketId}`);
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Carregando notificações...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span className="font-medium text-sm">Notificações</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-6 px-2 text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Marcar todas
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={forceSync}
              className="h-6 px-2 text-xs opacity-50 hover:opacity-100"
              title="Forçar sincronização"
            >
              🔄
            </Button>
          </div>
        </div>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        ) : (
          <div className="p-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-3 rounded-lg mb-2 last:mb-0 transition-colors cursor-pointer hover:bg-muted/50 ${
                  notification.recipient_status?.is_read 
                    ? 'bg-muted/30' 
                    : 'bg-background border border-primary/20'
                }`}
              >
                <div className="flex items-start justify-between space-x-2">
                  <div className="flex items-start space-x-2 flex-1 min-w-0">
                    <div className={`p-1.5 rounded-full shrink-0 ${
                      notification.recipient_status?.is_read ? 'bg-muted' : 'bg-primary/10'
                    }`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <h4 className={`font-medium text-sm ${
                          notification.recipient_status?.is_read 
                            ? 'text-muted-foreground' 
                            : 'text-foreground'
                        }`}>
                          {notification.title}
                        </h4>
                        <div className="flex gap-1">
                          <Badge 
                            variant={getNotificationVariant(notification.type)}
                            className="text-xs h-4 shrink-0"
                          >
                            {notification.type === 'franqueado_respondeu' ? 'Resposta' : notification.type}
                          </Badge>
                          {notification.equipe?.nome && (
                            <Badge variant="outline" className="text-xs h-4 shrink-0">
                              {notification.equipe.nome}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {notification.message && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                          {notification.message.replace(/Ticket [a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'Ticket')}
                        </p>
                      )}
                      
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span>
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                        {notification.recipient_status?.is_read && (
                          <>
                            <span className="mx-1">•</span>
                            <span>Lida</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {!notification.recipient_status?.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      className="h-6 w-6 p-0 shrink-0"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};