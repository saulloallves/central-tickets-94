import { ReactNode } from 'react';
import { usePermissions, AppPermission } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  children: ReactNode;
  requiredPermission?: AppPermission;
  requiredPermissions?: AppPermission[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

export const PermissionGuard = ({ 
  children, 
  requiredPermission, 
  requiredPermissions = [],
  requireAll = false,
  fallback = null 
}: PermissionGuardProps) => {
  const { hasPermission, hasAnyPermission, loading } = usePermissions();

  if (loading) {
    return <div className="animate-pulse bg-muted h-4 w-24 rounded"></div>;
  }

  // Single permission check
  if (requiredPermission) {
    return hasPermission(requiredPermission) ? <>{children}</> : <>{fallback}</>;
  }

  // Multiple permissions check
  if (requiredPermissions.length > 0) {
    const hasAccess = requireAll 
      ? requiredPermissions.every(permission => hasPermission(permission))
      : hasAnyPermission(requiredPermissions);
    
    return hasAccess ? <>{children}</> : <>{fallback}</>;
  }

  // No permission requirements - render children
  return <>{children}</>;
};