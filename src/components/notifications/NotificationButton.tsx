import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInternalNotifications } from '@/hooks/useInternalNotifications';

interface NotificationButtonProps {
  isExpanded: boolean;
}

export const NotificationButton = ({ isExpanded }: NotificationButtonProps) => {
  const { unreadCount } = useInternalNotifications();

  const button = (
    <Button 
      variant="ghost" 
      size="sm" 
      className={`relative text-white hover:bg-white/5 transition-all duration-300 ${
        isExpanded ? 'w-full justify-start px-4' : 'w-10 h-10 p-0'
      }`}
    >
      <Bell className="h-4 w-4" />
      {isExpanded && <span className="ml-2">Notificações</span>}
      {unreadCount > 0 && (
        <Badge 
          variant="destructive" 
          className={`absolute h-5 w-5 p-0 flex items-center justify-center text-xs ${
            isExpanded ? '-top-1 -right-1' : '-top-1 -right-1'
          }`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );

  if (!isExpanded) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent 
            side="right" 
            className="liquid-glass-card text-white ml-2"
          >
            Notificações {unreadCount > 0 && `(${unreadCount})`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};