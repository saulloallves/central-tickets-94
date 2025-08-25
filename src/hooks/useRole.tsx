import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'supervisor' | 'diretor' | 'colaborador' | 'diretoria' | 'gestor_equipe' | 'gestor_unidade' | 'franqueado' | 'auditor_juridico' | 'gerente';

export const useRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching roles:', error);
          setRoles([]);
        } else {
          setRoles(data?.map(r => r.role as AppRole) || []);
        }
      } catch (error) {
        console.error('Error fetching roles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [user]);

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const isAdmin = (): boolean => hasRole('admin');
  const isSupervisor = (): boolean => hasRole('supervisor');
  const isDiretor = (): boolean => hasRole('diretor');
  const isColaborador = (): boolean => hasRole('colaborador');
  const isFranqueado = (): boolean => hasRole('franqueado');
  const isGerente = (): boolean => hasRole('gerente');

  return {
    roles,
    hasRole,
    isAdmin,
    isSupervisor,
    isDiretor,
    isColaborador,
    isFranqueado,
    isGerente,
    loading
  };
};