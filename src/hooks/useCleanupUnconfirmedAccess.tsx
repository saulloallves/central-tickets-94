import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useCleanupUnconfirmedAccess = () => {
  const cleanupUnconfirmedRequests = async () => {
    const { data, error } = await supabase.rpc('cleanup_unconfirmed_access_requests');
    
    if (error) {
      console.error('Erro ao limpar solicitações não confirmadas:', error);
      throw error;
    }
    
    return data;
  };

  const monitorUnconfirmedUsers = async () => {
    const { data, error } = await supabase.rpc('monitor_unconfirmed_users');
    
    if (error) {
      console.error('Erro ao monitorar usuários não confirmados:', error);
      throw error;
    }
    
    return data;
  };

  return {
    cleanupUnconfirmedRequests,
    monitorUnconfirmedUsers
  };
};