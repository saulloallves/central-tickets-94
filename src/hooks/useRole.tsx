import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'supervisor' | 'diretor' | 'colaborador' | 'diretoria' | 'gestor_equipe' | 'gestor_unidade' | 'franqueado' | 'auditor_juridico' | 'gerente';

export const useRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPendingAccess, setHasPendingAccess] = useState(false);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      try {
        // Verificar roles aprovadas
        const { data, error } = await supabase
          .from('user_roles')
          .select('role, approved')
          .eq('user_id', user.id);

        // Verificar se há solicitação pendente
        const { data: pendingRequest } = await supabase
          .from('internal_access_requests')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (error) {
          console.error('Error fetching roles:', error);
          setRoles([]);
        } else {
          // Filtrar apenas roles aprovadas
          let userRoles = data?.filter(r => r.approved).map(r => r.role as AppRole) || [];
          
          // Se não tem roles aprovadas e tem email, verificar se é franqueado
          if (userRoles.length === 0 && user.email) {
            const { data: franqueadoData } = await supabase
              .from('franqueados')
              .select('id')
              .eq('email', user.email)
              .maybeSingle();
            
            if (franqueadoData) {
              userRoles = ['franqueado'];
            }
          }
          
          setRoles(userRoles);
        }

        // Definir se há acesso pendente
        setHasPendingAccess(!!pendingRequest);
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
    loading,
    hasPendingAccess
  };
};