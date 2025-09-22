import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInternalNotifications } from '@/hooks/useInternalNotifications';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useToast } from '@/hooks/use-toast';

/**
 * Componente global para escutar notificações em tempo real
 * Deve ser incluído no App.tsx para funcionar em todas as rotas
 */
export const GlobalNotificationListener = () => {
  const { user } = useAuth();
  
  // Escuta notificações internas (internal_notifications)
  const { unreadCount } = useInternalNotifications();
  
  // Escuta notificações da fila e SLAs
  useRealtimeNotifications();

  useEffect(() => {
    if (user) {
      console.log('🌐 GlobalNotificationListener ativo para usuário:', user.id);
      console.log('🔔 Notificações não lidas:', unreadCount);
    }
  }, [user?.id, unreadCount]);

  // Componente invisível - apenas executa os hooks em background
  return null;
};