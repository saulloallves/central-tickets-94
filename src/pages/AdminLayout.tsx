
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useUserEquipes } from "@/hooks/useUserEquipes";
import { useInternalAccessRequests } from "@/hooks/useInternalAccessRequests";
import { InternalAccessRequest } from "@/components/InternalAccessRequest";
import { AppSidebar } from "@/components/AppSidebar"
import { MobileBottomNav } from "@/components/MobileBottomNav"
import { Toaster } from "@/components/ui/toaster"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import PageTransition from "@/components/PageTransition";

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: roleLoading } = useRole();
  const { userEquipes, loading: equipeLoading } = useUserEquipes();
  const { userRequest, loading: requestLoading } = useInternalAccessRequests();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isFirstRender, setIsFirstRender] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Mark as not first render after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!authLoading && !roleLoading && !equipeLoading && !requestLoading) {
        setIsFirstRender(false);
      }
    }, 100); // Pequeno delay para evitar flicker

    return () => clearTimeout(timer);
  }, [authLoading, roleLoading, equipeLoading, requestLoading]);

  // Show loading spinner ONLY on first render or auth loading
  if ((authLoading || roleLoading || equipeLoading || requestLoading) && isFirstRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground font-medium">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  // Don't render admin content if not authenticated
  if (!user) {
    return null;
  }

  // Check if user has any access (roles or team membership)
  const hasRoles = roles.length > 0;
  const hasTeamAccess = userEquipes.length > 0;
  const hasPendingRequest = userRequest !== null;

  // If user has no access and no pending request, show access request form
  if (!hasRoles && !hasTeamAccess && !hasPendingRequest) {
    return <InternalAccessRequest />;
  }

  // If user has pending request, show the waiting screen
  if (!hasRoles && !hasTeamAccess && hasPendingRequest) {
    return <InternalAccessRequest />;
  }

  // User has access - render normal admin layout
  return (
    <div className="h-screen flex w-full bg-gradient-subtle overflow-hidden">
      {/* Desktop sidebar - FIXA */}
      {!isMobile && <AppSidebar />}
      
      <div 
        className={cn(
          "flex-1 flex flex-col h-full transition-all duration-300", 
          isMobile ? "pb-20" : "ml-20"
        )} 
        data-main-content
      >
        {/* Main content area - SCROLLÁVEL */}
        <main className={cn("flex-1 overflow-y-auto", isMobile ? "p-4" : "p-6")}>
          <PageTransition>
            <div className="w-full space-y-6">
              {children}
            </div>
          </PageTransition>
        </main>
      </div>
      
      {/* Mobile bottom navigation - FIXA */}
      {isMobile && <MobileBottomNav />}
      <Toaster />
    </div>
  )
}
