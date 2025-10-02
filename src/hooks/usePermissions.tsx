import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export type AppPermission = 
  | 'view_all_tickets'
  | 'view_own_unit_tickets'
  | 'view_team_tickets'
  | 'respond_tickets'
  | 'escalate_tickets'
  | 'access_dashboards'
  | 'manage_knowledge_base'
  | 'validate_ai_content'
  | 'configure_ai_models'
  | 'view_audit_logs'
  | 'export_reports'
  | 'view_all_history'
  | 'manage_crisis'
  | 'supervise_units'
  | 'validate_ai_responses';

export const usePermissions = () => {
  const { user } = useAuth();

  // Use React Query for global caching - reduces 9 queries to 1
  const { data: permissions = [], isLoading: loading } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase.rpc('get_user_permissions', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error fetching permissions:', error);
        // For network errors, return empty array but keep cache
        if (error.message?.includes('Failed to fetch')) {
          console.warn('Network error fetching permissions, keeping cache');
        }
        return [];
      }

      return data?.map((p: any) => p.permission as AppPermission) || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - permissions don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const hasPermission = (permission: AppPermission): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList: AppPermission[]): boolean => {
    return permissionList.some(permission => permissions.includes(permission));
  };

  const canViewAllTickets = (): boolean => hasPermission('view_all_tickets');
  const canViewOwnUnitTickets = (): boolean => hasPermission('view_own_unit_tickets');
  const canRespondTickets = (): boolean => hasPermission('respond_tickets');
  const canAccessDashboards = (): boolean => hasPermission('access_dashboards');
  const canManageKnowledgeBase = (): boolean => hasPermission('manage_knowledge_base');
  const canConfigureAI = (): boolean => hasPermission('configure_ai_models');
  const canViewAuditLogs = (): boolean => hasPermission('view_audit_logs');
  const canExportReports = (): boolean => hasPermission('export_reports');

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    canViewAllTickets,
    canViewOwnUnitTickets,
    canRespondTickets,
    canAccessDashboards,
    canManageKnowledgeBase,
    canConfigureAI,
    canViewAuditLogs,
    canExportReports,
    loading
  };
};