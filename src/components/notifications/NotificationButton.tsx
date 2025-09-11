import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useInternalNotifications } from '@/hooks/useInternalNotifications';
import { InternalNotificationsList } from './InternalNotificationsList';

interface NotificationButtonProps {
  isExpanded: boolean;
  variant?: 'sidebar' | 'tickets';
  onNotificationOpen?: () => void;
  onNotificationClose?: () => void;
}

export const NotificationButton = ({ isExpanded, variant = 'tickets', onNotificationOpen, onNotificationClose }: NotificationButtonProps) => {
  const { unreadCount } = useInternalNotifications();

  const getButtonStyles = () => {
    if (variant === 'sidebar') {
      return `relative text-white hover:bg-white/5 transition-all duration-300 ${
        isExpanded ? 'w-full justify-start px-4' : 'w-10 h-10 p-0'
      }`;
    }
    return `relative text-foreground hover:bg-accent transition-all duration-300 ${
      isExpanded ? 'w-full justify-start px-4' : 'w-10 h-10 p-0'
    }`;
  };

  const button = (
    <Button 
      variant="ghost" 
      size="sm" 
      className={getButtonStyles()}
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

  const popoverContent = (
    <PopoverContent 
      className="w-80 max-w-sm p-0 bg-background border-border shadow-lg z-50" 
      side={variant === 'sidebar' ? "right" : "bottom"}
      align={variant === 'sidebar' ? "start" : "end"}
      sideOffset={variant === 'sidebar' ? 0 : 8}
      alignOffset={0}
      avoidCollisions={false}
      style={variant === 'sidebar' ? {
        position: 'fixed',
        left: '150px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 9999
      } : {}}
    >
      <InternalNotificationsList />
    </PopoverContent>
  );

  if (!isExpanded) {
    return (
      <Popover 
        onOpenChange={(open) => {
          if (variant === 'sidebar') {
            if (open) {
              onNotificationOpen?.();
            } else {
              onNotificationClose?.();
            }
          }
        }}
      >
        <TooltipProvider>
          <Tooltip>
            <PopoverTrigger asChild>
              <TooltipTrigger asChild>
                {button}
              </TooltipTrigger>
            </PopoverTrigger>
            <TooltipContent 
              side="right" 
              className="liquid-glass-card text-white ml-2"
              sideOffset={variant === 'sidebar' ? 20 : 8}
            >
              Notificações {unreadCount > 0 && `(${unreadCount})`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {popoverContent}
      </Popover>
    );
  }

  return (
    <Popover 
      onOpenChange={(open) => {
        if (variant === 'sidebar') {
          if (open) {
            onNotificationOpen?.();
          } else {
            onNotificationClose?.();
          }
        }
      }}
    >
      <PopoverTrigger asChild>
        {button}
      </PopoverTrigger>
      {popoverContent}
    </Popover>
  );
};