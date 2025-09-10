import { Bell, Check, CheckCheck, Clock, AlertTriangle, Info, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInternalNotifications, InternalNotification } from '@/hooks/useInternalNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const getNotificationVariant = (type: string) => {
  switch (type) {
    case 'crisis':
      return 'destructive';
    case 'alert':
    case 'sla':
      return 'secondary';
    case 'ticket':
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
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useInternalNotifications();

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notificações</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="flex items-center space-x-1"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Marcar todas como lidas</span>
            </Button>
          )}
        </div>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="p-0">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma notificação encontrada</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="p-4 space-y-3">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};