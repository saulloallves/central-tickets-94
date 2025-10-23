import { useLocation } from 'react-router-dom';
import { GlobalNotificationListener } from './GlobalNotificationListener';

/**
 * Wrapper condicional para GlobalNotificationListener
 * Evita carregar notificações em rotas públicas e mobile
 */
export const ConditionalNotificationListener = () => {
  const location = useLocation();
  
  // Não carregar em rotas mobile (públicas)
  if (location.pathname.startsWith('/mobile')) {
    return null;
  }
  
  // Não carregar em rotas públicas
  const publicRoutes = ['/auth', '/pending-approval', '/reset-password', '/'];
  if (publicRoutes.includes(location.pathname)) {
    return null;
  }
  
  return <GlobalNotificationListener />;
};
