import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';

export const useIsAtendente = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const [isAtendente, setIsAtendente] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAtendente = async () => {
      if (!user?.email || roleLoading) {
        setLoading(true);
        return;
      }

      // Se é admin, tem acesso automaticamente
      if (isAdmin()) {
        setIsAtendente(true);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('atendentes')
          .select('id, ativo, email')
          .eq('email', user.email)
          .eq('ativo', true)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking atendente status:', error);
          setIsAtendente(false);
        } else {
          setIsAtendente(!!data);
        }
      } catch (error) {
        console.error('Error in useIsAtendente:', error);
        setIsAtendente(false);
      } finally {
        setLoading(false);
      }
    };

    checkAtendente();
  }, [user?.email, isAdmin, roleLoading]);

  return {
    isAtendente: isAdmin() || isAtendente,
    loading: loading || roleLoading
  };
};