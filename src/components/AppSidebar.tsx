import { 
  Users, 
  Building2, 
  UserCheck, 
  ClipboardList, 
  Settings, 
  LogOut,
  Home,
  Users2,
  BarChart3,
  Activity,
  Shield,
  ChevronRight
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { usePermissions } from "@/hooks/usePermissions";
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
  const currentPath = location.pathname;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="w-14 h-[calc(100vh-8rem)] fixed left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col">
        {/* Futuristic curved sidebar with organic cuts */}
        <div className="
          relative flex-1 bg-gradient-sidebar rounded-[3rem] shadow-glow backdrop-blur-xl border border-white/20 
          overflow-visible min-h-[600px]
          before:content-[''] before:absolute before:left-[-28px] before:top-[-32px] 
          before:w-28 before:h-28 before:bg-background before:rounded-full before:pointer-events-none before:z-0
          after:content-[''] after:absolute after:left-[-36px] after:bottom-[-36px] 
          after:w-32 after:h-32 after:bg-background after:rounded-full after:pointer-events-none after:z-0
        ">
          {/* Glass overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-[3rem] z-10" />
          
          {/* Content container */}
          <div className="relative z-10 flex flex-col h-full">
            {/* Header Icon */}
            <div className="p-3 flex justify-center">
              <div className="w-8 h-8 rounded-xl bg-white/25 backdrop-blur-md flex items-center justify-center shadow-neumorphic">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
            </div>

            {/* Navigation Icons */}
            <div className="flex-1 px-2 py-4 space-y-2 flex flex-col justify-center">
              {navigationItems.map((item) => (
                <PermissionGuard key={item.title} requiredPermission={item.permission}>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) => cn(
                          "group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-500",
                          isActive 
                            ? "bg-white/30 backdrop-blur-md shadow-neumorphic" 
                            : "hover:bg-white/15 hover:backdrop-blur-md hover:scale-110"
                        )}
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon className={cn(
                              "h-4 w-4 transition-all duration-300 group-hover:scale-110",
                              isActive ? "text-white" : "text-white/80"
                            )} />
                            {isActive && (
                              <span className="absolute right-[-6px] w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                            )}
                          </>
                        )}
                      </NavLink>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-white/95 text-gray-800 shadow-elegant rounded-xl border border-white/20">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                </PermissionGuard>
              ))}
            </div>

            {/* Footer Logout */}
            <div className="p-3 flex justify-center">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    onClick={handleSignOut}
                    className="group relative w-10 h-10 rounded-xl p-0 text-white/80 hover:text-white hover:bg-red-500/20 hover:backdrop-blur-md transition-all duration-500 hover:scale-110"
                  >
                    <LogOut className="h-4 w-4 transition-all duration-300 group-hover:scale-110" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-white/95 text-gray-800 shadow-elegant rounded-xl border border-white/20">
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