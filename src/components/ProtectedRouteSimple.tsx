import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRole, AppRole } from '@/hooks/useRole';
import { Navigate, useLocation } from 'react-router-dom';
import { EmailConfirmationRequired } from '@/components/EmailConfirmationRequired';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  requiredRoles?: AppRole[];
}

export const ProtectedRoute = ({ children, requiredRole, requiredRoles }: ProtectedRouteProps) => {
  const { user, loading, emailConfirmed } = useAuth();
  const { hasRole, loading: roleLoading, hasPendingAccess } = useRole();
  const location = useLocation();
  const [isImportedUser, setIsImportedUser] = useState<boolean | null>(null);
  const [checkingImport, setCheckingImport] = useState(true);

  // Verificar se é usuário importado
  useEffect(() => {
    const checkImportedStatus = async () => {
      if (!user?.id) {
        setCheckingImport(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('is_imported_user')
        .eq('id', user.id)
        .single();

      setIsImportedUser(data?.is_imported_user ?? false);
      setCheckingImport(false);
    };

    checkImportedStatus();
  }, [user?.id]);

  console.log('🛡️ ProtectedRoute check:', { 
    user: user?.id, 
    loading, 
    roleLoading,
    checkingImport,
    isImportedUser,
    hasPendingAccess,
    requiredRole,
    requiredRoles 
  });

  if (loading || roleLoading || checkingImport) {
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

  // Verificar se o email está confirmado
  if (!emailConfirmed) {
    return <EmailConfirmationRequired />;
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