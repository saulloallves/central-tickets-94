
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface UserEquipe {
  id: string;
  equipe_id: string;
  role: string;
  is_primary: boolean;
  ativo: boolean;
  equipes: {
    id: string;
    nome: string;
    ativo: boolean;
  };
}

export const useUserEquipes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userEquipes, setUserEquipes] = useState<UserEquipe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserEquipes = async (isRefetch = false) => {
    if (!user) {
      setUserEquipes([]);
      setLoading(false);
      return;
    }

    try {
      // Only set loading on initial fetch, not on refetches
      if (!isRefetch) {
        setLoading(true);
      }
      
      const { data, error } = await supabase
        .from('equipe_members')
        .select(`
          *,
          equipes:equipe_id (
            id,
            nome,
            ativo
          )
        `)
        .eq('user_id', user.id)
        .eq('ativo', true)
        .eq('equipes.ativo', true);

      if (error) {
        console.error('Error fetching user equipes:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar suas equipes",
          variant: "destructive",
        });
        return;
      }

      setUserEquipes((data as any) || []);
    } catch (error) {
      console.error('Error fetching user equipes:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar equipes do usuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserEquipes();
  }, [user?.id]);

  // Optimized Realtime subscription - prevent multiple channels and add debounce
  useEffect(() => {
    if (!user) return;

    let debounceTimeout: NodeJS.Timeout | null = null;
    const channelName = `user-equipes-${user.id}`;
    
    // Check if channel already exists to prevent duplicates
    const existingChannel = supabase.getChannels().find(ch => ch.topic === channelName);
    if (existingChannel) {
      console.log('🔄 Equipes channel already exists, skipping duplicate');
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipe_members',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Realtime equipe change:', payload);
          
          // Debounce refetch to prevent multiple rapid updates
          if (debounceTimeout) {
            clearTimeout(debounceTimeout);
          }
          
          debounceTimeout = setTimeout(() => {
            fetchUserEquipes(true);
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Retorna a equipe primária ou a primeira se não houver primária
  const getPrimaryEquipe = (): UserEquipe | null => {
    if (userEquipes.length === 0) return null;
    
    const primary = userEquipes.find(eq => eq.is_primary);
    return primary || userEquipes[0];
  };

  return {
    userEquipes,
    loading,
    getPrimaryEquipe,
    refetch: () => fetchUserEquipes(true)
  };
};
