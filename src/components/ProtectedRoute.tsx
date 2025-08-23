
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRole, AppRole } from '@/hooks/useRole';
import { usePermissions, AppPermission } from '@/hooks/usePermissions';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
  requiredPermission?: AppPermission;
  requiredPermissions?: AppPermission[];
  requireAll?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requiredRole,
  requiredPermission,
  requiredPermissions = [],
  requireAll = false
}: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { hasRole, loading: roleLoading } = useRole();
  const { hasPermission, hasAnyPermission, loading: permissionsLoading } = usePermissions();

  if (authLoading || roleLoading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If both role and permission are specified, user needs EITHER
  const hasRoleAccess = requiredRole ? hasRole(requiredRole) : false;
  const hasPermissionAccess = requiredPermission ? hasPermission(requiredPermission) : false;

  // Check role-based access OR permission-based access
  if (requiredRole && requiredPermission) {
    if (!hasRoleAccess && !hasPermissionAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
            <p className="mt-2 text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </div>
        </div>
      );
    }
  } else if (requiredRole && !hasRoleAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
          <p className="mt-2 text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  } else if (requiredPermission && !hasPermissionAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
          <p className="mt-2 text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  // Check multiple permissions
  if (requiredPermissions.length > 0) {
    const hasAccess = requireAll 
      ? requiredPermissions.every(permission => hasPermission(permission))
      : hasAnyPermission(requiredPermissions);
    
    if (!hasAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
            <p className="mt-2 text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
