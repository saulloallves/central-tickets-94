import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useRole } from './useRole';
import { supabase } from '@/integrations/supabase/client';

export const useIsConciergeTeamMember = () => {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [isConciergeTeamMember, setIsConciergeTeamMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsConciergeTeamMember(false);
      setLoading(false);
      return;
    }

    // Admins always have access
    if (isAdmin()) {
      setIsConciergeTeamMember(true);
      setLoading(false);
      return;
    }

    const checkConciergeTeamMembership = async () => {
      try {
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
          setIsConciergeTeamMember(false);
        } else {
          const isMember = data && data.length > 0;
          setIsConciergeTeamMember(isMember);
        }
      } catch (error) {
        console.error('Error checking concierge team membership:', error);
        setIsConciergeTeamMember(false);
      } finally {
        setLoading(false);
      }
    };

    checkConciergeTeamMembership();
  }, [user, isAdmin]);

  return {
    isConciergeTeamMember: isAdmin() || isConciergeTeamMember,
    loading
  };
};