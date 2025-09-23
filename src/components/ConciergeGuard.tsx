import { ReactNode } from 'react';
import { useIsConciergeTeamMember } from '@/hooks/useIsConciergeTeamMember';

interface ConciergeGuardProps {
  children: ReactNode;
}

export function ConciergeGuard({ children }: ConciergeGuardProps) {
  const { isConciergeTeamMember, loading } = useIsConciergeTeamMember();

  if (loading) {
    return null;
  }

  if (!isConciergeTeamMember) {
    return null;
  }

  return <>{children}</>;
}