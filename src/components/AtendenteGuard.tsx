import { ReactNode } from 'react';
import { useIsAtendente } from '@/hooks/useIsAtendente';

interface AtendenteGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const AtendenteGuard = ({ 
  children, 
  fallback = null 
}: AtendenteGuardProps) => {
  const { isAtendente, loading } = useIsAtendente();

  if (loading) {
    return <div className="animate-pulse bg-muted h-4 w-24 rounded"></div>;
  }

  return isAtendente ? <>{children}</> : <>{fallback}</>;
};