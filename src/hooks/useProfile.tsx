import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
          throw error;
        }

        setProfile(data);
        setError(null);
      } catch (err) {
        console.error('Erro ao carregar perfil:', err);
        setError('Erro ao carregar perfil');
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();

    // Subscription para mudanças em tempo real
    const subscription = supabase
      .channel('profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setProfile(payload.new as Profile);
          } else if (payload.eventType === 'DELETE') {
            setProfile(null);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const refreshProfile = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setProfile(data);
      setError(null);
    } catch (err) {
      console.error('Erro ao recarregar perfil:', err);
      setError('Erro ao recarregar perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>) => {
    if (!user) return { success: false, error: 'Usuário não autenticado' };

    try {
      console.log('Attempting to update profile:', {
        userId: user.id,
        updates,
        userEmail: user.email
      });

      // First check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('Existing profile:', existingProfile);

      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Database error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('Profile updated successfully:', data);
      setProfile(data);
      return { success: true, data };
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err);
      const errorMessage = err?.message 
        ? `${err.message} (Código: ${err.code || 'desconhecido'})` 
        : 'Erro desconhecido';
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  return {
    profile,
    isLoading,
    error,
    refreshProfile,
    updateProfile
  };
}