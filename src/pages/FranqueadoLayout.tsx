import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { FranqueadoAppSidebar } from "@/components/FranqueadoAppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Toaster } from "@/components/ui/toaster";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SystemLogo } from "@/components/SystemLogo";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto"></div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Carregando sistema...</p>
            <p className="text-sm text-muted-foreground">Aguarde um momento</p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated
  if (!user) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="min-h-screen flex w-full bg-background">
        <div className="flex-1 flex flex-col pb-16">
          {/* Mobile Header */}
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center space-x-3">
                <SystemLogo />
                <div>
                  <h1 className="text-lg font-semibold">Sistema Franqueado</h1>
                  <p className="text-xs text-muted-foreground">Painel de Controle</p>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
            </div>
          </header>

          {/* Mobile Content */}
          <main className="flex-1 p-4">
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
        </div>
        
        {/* Mobile bottom navigation */}
        <MobileBottomNav />
        <Toaster />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <FranqueadoAppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Desktop Header */}
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center space-x-4">
                <SidebarTrigger className="mr-2" />
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">Sistema Franqueado</h1>
                  <p className="text-sm text-muted-foreground">Gerencie suas operações</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                    3
                  </span>
                </Button>
              </div>
            </div>
          </header>

          {/* Desktop Content */}
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto p-6 space-y-6 animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}