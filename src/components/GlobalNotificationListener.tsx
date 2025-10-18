import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useInternalNotifications } from '@/hooks/useInternalNotifications';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

/**
 * Componente global para escutar notificações em tempo real
 * Deve ser incluído no App.tsx para funcionar em todas as rotas
 */
export const GlobalNotificationListener = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  
  // Verifica se está em rota mobile
  const isMobileRoute = location.pathname.startsWith('/mobile');
  
  // Escuta notificações internas (internal_notifications) - exceto em mobile
  const { unreadCount } = useInternalNotifications();
  
  // Escuta notificações da fila e SLAs - desabilitado em mobile
  useRealtimeNotifications(!isMobileRoute);

  // Sistema simplificado - remove duplicação de listeners

  useEffect(() => {
    if (user && !isMobileRoute) {
      console.log('🌐 GlobalNotificationListener ativo para usuário:', user.id);
      console.log('🔔 Notificações não lidas:', unreadCount);
    }
  }, [user?.id, unreadCount, isMobileRoute]);

  // Componente invisível - apenas executa os hooks em background
  return null;
};