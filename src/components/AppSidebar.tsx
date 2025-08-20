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
    <div className="w-16 h-[calc(100vh-8rem)] fixed left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col">
      {/* Futuristic curved sidebar - centralized */}
      <div className="flex-1 bg-gradient-primary rounded-[3rem] shadow-glow backdrop-blur-xl border border-white/20 relative overflow-hidden min-h-[600px]">
        {/* Organic curve decorations */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-[3rem]" />
        <div className="absolute -right-6 top-1/4 w-12 h-24 bg-gradient-to-l from-white/5 to-transparent rounded-l-full" />
        <div className="absolute -right-4 bottom-1/3 w-8 h-16 bg-gradient-to-l from-white/3 to-transparent rounded-l-full" />
        <div className="absolute -right-8 top-1/2 w-16 h-32 bg-gradient-to-l from-white/5 to-transparent rounded-l-full" />
        
        {/* Header Icon */}
        <div className="p-4 flex justify-center">
          <div className="w-10 h-10 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center shadow-neumorphic">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Navigation Icons */}
        <div className="flex-1 px-2 py-6 space-y-3 flex flex-col justify-center">
          {navigationItems.map((item) => (
            <PermissionGuard key={item.title} requiredPermission={item.permission}>
              <NavLink
                to={item.url}
                end
                className={({ isActive }) => cn(
                  "group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-500 hover:scale-110",
                  isActive 
                    ? "bg-white/30 backdrop-blur-md shadow-neumorphic scale-105" 
                    : "hover:bg-white/15 hover:backdrop-blur-md"
                )}
              >
                <item.icon className="h-4 w-4 text-white transition-all duration-300 group-hover:scale-110" />
                
                {/* Tooltip melhorado */}
                <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md text-gray-800 px-3 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-elegant z-50 border border-white/20">
                  {item.title}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-white/95 rotate-45 border-l border-b border-white/20" />
                </div>
              </NavLink>
            </PermissionGuard>
          ))}
        </div>

        {/* Footer Logout */}
        <div className="p-4 flex justify-center">
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className="group relative w-10 h-10 rounded-xl p-0 text-white hover:bg-red-500/20 hover:backdrop-blur-md transition-all duration-500 hover:scale-110"
          >
            <LogOut className="h-4 w-4 transition-all duration-300 group-hover:scale-110" />
            
            {/* Tooltip de logout */}
            <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md text-gray-800 px-3 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-elegant z-50 border border-white/20">
              Sair do Sistema
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-white/95 rotate-45 border-l border-b border-white/20" />
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}