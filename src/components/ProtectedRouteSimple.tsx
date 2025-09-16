import { useAuth } from '@/hooks/useAuth';
import { useRole, AppRole } from '@/hooks/useRole';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  requiredRoles?: AppRole[];
}

export const ProtectedRoute = ({ children, requiredRole, requiredRoles }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { hasRole, loading: roleLoading, hasPendingAccess } = useRole();
  const location = useLocation();

  console.log('🛡️ ProtectedRoute check:', { 
    user: user?.id, 
    loading, 
    roleLoading, 
    hasPendingAccess,
    requiredRole,
    requiredRoles 
  });

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent mx-auto"></div>
          <p className="mt-4 text-white/80 font-medium">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Se o usuário tem solicitação pendente e não tem nenhuma role aprovada
  if (hasPendingAccess && !hasRole('admin') && !hasRole('supervisor') && !hasRole('colaborador') && !hasRole('franqueado') && !hasRole('diretoria')) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRoles && !requiredRoles.some(role => hasRole(role))) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};