import { 
  Users, 
  Building2, 
  UserCheck, 
  ClipboardList, 
  Settings, 
  LogOut,
  Home,
  Users2,
  Activity,
  Shield
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGuard } from "@/components/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navigationItems = [
  { title: "Dashboard", url: "/admin", icon: Home, permission: 'access_dashboards' as const },
  { title: "Unidades", url: "/admin/unidades", icon: Building2, permission: 'view_all_tickets' as const },
  { title: "Franqueados", url: "/admin/franqueados", icon: Users, permission: 'view_all_tickets' as const },
  { title: "Colaboradores", url: "/admin/colaboradores", icon: UserCheck, permission: 'view_all_tickets' as const },
  { title: "Tickets", url: "/admin/tickets", icon: ClipboardList, permission: 'view_own_unit_tickets' as const },
  { title: "Equipes", url: "/admin/equipes", icon: Users2, permission: 'view_all_tickets' as const },
  { title: "Permissões", url: "/admin/permissions", icon: Shield, permission: 'configure_ai_models' as const },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings, permission: 'configure_ai_models' as const },
  { title: "Logs & Auditoria", url: "/admin/logs", icon: Activity, permission: 'view_audit_logs' as const },
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="w-20 h-[calc(100vh-4rem)] fixed left-2 top-1/2 -translate-y-1/2 z-40">
        {/* Modern curved sidebar container */}
        <div className="
          relative h-full bg-gradient-sidebar shadow-glow backdrop-blur-xl
          rounded-t-[24px] rounded-b-[24px] overflow-hidden
          border border-white/20
          before:absolute before:top-0 before:right-0 before:w-8 before:h-1/3
          before:bg-gradient-to-l before:from-white/10 before:to-transparent
          before:rounded-bl-[40px]
          after:absolute after:bottom-0 after:right-0 after:w-8 after:h-1/3
          after:bg-gradient-to-l after:from-white/10 after:to-transparent
          after:rounded-tl-[40px]
        ">
          {/* Curved right edge effect */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-3/4">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-l-full"></div>
          </div>
          
          {/* Content wrapper with padding for curves */}
          <div className="relative z-10 h-full flex flex-col py-6 px-2">
            {/* Main logo/brand icon */}
            <div className="flex justify-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-neumorphic border border-white/30">
                <ClipboardList className="h-6 w-6 text-white" strokeWidth={1.5} />
              </div>
            </div>

            {/* Navigation Icons */}
            <div className="flex-1 flex flex-col items-center space-y-4">
              {navigationItems.map((item) => (
                <PermissionGuard key={item.title} requiredPermission={item.permission}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) => cn(
                          "group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300",
                          "hover:scale-105 hover:bg-white/15",
                          isActive 
                            ? "bg-white/25 backdrop-blur-md shadow-neumorphic scale-105" 
                            : "hover:bg-white/10"
                        )}
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon 
                              className={cn(
                                "h-5 w-5 text-white transition-all duration-300",
                                isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "opacity-80"
                              )} 
                              strokeWidth={1.5}
                            />
                            
                            {/* Active indicator - green dot */}
                            {isActive && (
                              <div className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
                            )}
                          </>
                        )}
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      className="bg-white/95 backdrop-blur-md text-gray-800 shadow-elegant rounded-xl border border-white/20 ml-2"
                    >
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                </PermissionGuard>
              ))}
            </div>

            {/* Logout button at bottom */}
            <div className="flex justify-center mt-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    onClick={handleSignOut}
                    className="group relative w-12 h-12 rounded-xl p-0 text-white hover:bg-red-500/20 hover:scale-105 transition-all duration-300"
                  >
                    <LogOut className="h-5 w-5 opacity-80 group-hover:opacity-100 transition-all duration-300" strokeWidth={1.5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  className="bg-white/95 backdrop-blur-md text-gray-800 shadow-elegant rounded-xl border border-white/20 ml-2"
                >
                  Sair do Sistema
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}