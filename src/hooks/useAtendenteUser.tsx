import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  nome_completo?: string;
  email?: string;
}

export const useAtendenteUser = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome_completo, email')
        .order('nome_completo', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const linkAtendenteToUser = async (atendenteId: string, userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-atendentes', {
        body: { 
          action: 'update', 
          id: atendenteId, 
          data: { user_id: userId } 
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Atendente vinculado ao usuário com sucesso",
      });
    } catch (error) {
      console.error('Error linking atendente to user:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível vincular o atendente",
        variant: "destructive",
      });
      throw error;
    }
  };

  const unlinkAtendenteFromUser = async (atendenteId: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-atendentes', {
        body: { 
          action: 'update', 
          id: atendenteId, 
          data: { user_id: null } 
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Atendente desvinculado do usuário",
      });
    } catch (error) {
      console.error('Error unlinking atendente from user:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desvincular o atendente",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    linkAtendenteToUser,
    unlinkAtendenteFromUser,
    refetch: fetchUsers
  };
};