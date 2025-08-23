import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

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
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_permissions', {
          _user_id: user.id
        });

        if (error) {
          console.error('Error fetching permissions:', error);
          // Only set empty array if it's not a network error
          if (error.message?.includes('Failed to fetch')) {
            // Network error - keep existing permissions if any
            console.warn('Network error fetching permissions, keeping existing state');
          } else {
            setPermissions([]);
          }
        } else {
          setPermissions(data?.map((p: any) => p.permission) || []);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        // For network errors, don't clear existing permissions
        if (error instanceof TypeError && error.message?.includes('Failed to fetch')) {
          console.warn('Network connectivity issue, keeping existing permissions');
        } else {
          setPermissions([]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

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