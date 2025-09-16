import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useRoleRefresh = () => {
  const { user } = useAuth();

  const refreshUserRoles = useCallback(async () => {
    if (!user) return;

    try {
      console.log('🔄 Refreshing user roles...');
      
      // Chamar função do banco para refresh
      const { data, error } = await supabase.rpc('refresh_user_permissions', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Erro ao refresh roles:', error);
        return { error };
      }

      console.log('✅ Roles refreshed:', data);
      
      // Forçar refresh na próxima verificação de roles
      window.dispatchEvent(new CustomEvent('roles-updated'));
      
      return { data, error: null };
    } catch (error) {
      console.error('Erro no refresh:', error);
      return { error };
    }
  }, [user]);

  return { refreshUserRoles };
};