import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'supervisor' | 'diretor' | 'colaborador' | 'diretoria' | 'gestor_equipe' | 'gestor_unidade' | 'franqueado' | 'auditor_juridico' | 'gerente';

export const useRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPendingAccess, setHasPendingAccess] = useState(false);
  const [roleCache, setRoleCache] = useState<{ [key: string]: { roles: AppRole[], timestamp: number, pending: boolean } }>({});

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      setHasPendingAccess(false);
      return;
    }

    const fetchRoles = async () => {
      try {
        console.log('🔑 Fetching roles for user:', user.id);
        
        // Check cache first (5 minute TTL)
        const cachedData = roleCache[user.id];
        if (cachedData && (Date.now() - cachedData.timestamp) < 300000) {
          console.log('🔑 Using cached roles:', cachedData.roles);
          setRoles(cachedData.roles);
          setHasPendingAccess(cachedData.pending);
          setLoading(false);
          return;
        }

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
          console.error('🔑 Error fetching roles:', error);
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
          
          console.log('🔑 User roles found:', userRoles);
          setRoles(userRoles);
          
          // Cache the results
          setRoleCache(prev => ({
            ...prev,
            [user.id]: {
              roles: userRoles,
              pending: !!pendingRequest,
              timestamp: Date.now()
            }
          }));
        }

        // Definir se há acesso pendente
        setHasPendingAccess(!!pendingRequest);
      } catch (error) {
        console.error('🔑 Error fetching roles:', error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();

    // Listener para refresh automático de roles
    const handleRolesUpdate = () => {
      console.log('🔄 Roles update event received, refreshing...');
      // Clear cache for this user
      if (user?.id) {
        setRoleCache(prev => {
          const newCache = { ...prev };
          delete newCache[user.id];
          return newCache;
        });
      }
      fetchRoles();
    };

    window.addEventListener('roles-updated', handleRolesUpdate);
    
    return () => {
      window.removeEventListener('roles-updated', handleRolesUpdate);
    };
  }, [user]); // ✅ CORREÇÃO: Removido roleCache das dependências para evitar loop infinito

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