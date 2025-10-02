import { useAuth } from './useAuth';
import { useRole } from './useRole';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export const useIsConciergeTeamMember = () => {
  const { user } = useAuth();
  const { isAdmin } = useRole();

  // Use React Query with sessionStorage cache for memoization
  const { data: isConciergeTeamMember = false, isLoading: loading } = useQuery({
    queryKey: ['concierge-membership', user?.id],
    queryFn: async () => {
      if (!user) return false;

      // Admins always have access
      if (isAdmin()) return true;

      // Check if user is member of any concierge team
      const { data, error } = await supabase
        .from('equipe_members')
        .select(`
          id,
          equipes!inner(
            id,
            nome
          )
        `)
        .eq('user_id', user.id)
        .eq('ativo', true)
        .or('nome.ilike.%concierge%', { foreignTable: 'equipes' });

      if (error) {
        console.error('Error checking concierge team membership:', error);
        return false;
      }

      return data && data.length > 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return {
    isConciergeTeamMember: isAdmin() || isConciergeTeamMember,
    loading
  };
};