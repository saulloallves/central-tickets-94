import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { FranqueadoAppSidebar } from "@/components/FranqueadoAppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Toaster } from "@/components/ui/toaster";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import { PushNotificationPrompt } from "@/components/notifications/PushNotificationPrompt";

interface FranqueadoLayoutProps {
  children: React.ReactNode;
}

export default function FranqueadoLayout({ children }: FranqueadoLayoutProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground font-medium">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex w-full bg-gradient-subtle">
      {/* Desktop sidebar */}
      {!isMobile && <FranqueadoAppSidebar />}
      
      <div 
        className={cn(
          "flex-1 flex flex-col transition-all duration-200", 
          isMobile ? "pb-20" : ""
        )} 
        data-main-content 
        style={{ marginLeft: isMobile ? '0' : '80px' }}
      >
        {/* Main content area with optimized spacing */}
        <main className={cn("flex-1", isMobile ? "p-4" : "p-6")}>
          <PageTransition>
            <div className="w-full space-y-6">
              {children}
            </div>
          </PageTransition>
        </main>
      </div>
      
      {/* Mobile bottom navigation */}
      {isMobile && <MobileBottomNav />}
      <Toaster />
      <PushNotificationPrompt />
    </div>
  );
}