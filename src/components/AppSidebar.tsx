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
    <div className="w-20 h-screen fixed left-4 top-4 bottom-4 z-40 flex flex-col">
      {/* Futuristic curved sidebar */}
      <div className="flex-1 bg-gradient-primary rounded-[2rem] shadow-glow backdrop-blur-xl border border-white/20 relative overflow-hidden">
        {/* Organic curve decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-[2rem]" />
        <div className="absolute -right-8 top-1/4 w-16 h-32 bg-gradient-to-l from-white/5 to-transparent rounded-l-full" />
        <div className="absolute -right-6 bottom-1/4 w-12 h-24 bg-gradient-to-l from-white/3 to-transparent rounded-l-full" />
        
        {/* Header Icon */}
        <div className="p-6 flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-neumorphic">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
        </div>

        {/* Navigation Icons */}
        <div className="flex-1 px-4 py-8 space-y-4">
          {navigationItems.map((item) => (
            <PermissionGuard key={item.title} requiredPermission={item.permission}>
              <NavLink
                to={item.url}
                end
                className={({ isActive }) => cn(
                  "group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-500 hover:scale-110",
                  isActive 
                    ? "bg-white/30 backdrop-blur-md shadow-neumorphic" 
                    : "hover:bg-white/10 hover:backdrop-blur-md"
                )}
                title={item.title}
              >
                <item.icon className="h-5 w-5 text-white transition-all duration-300 group-hover:scale-110" />
                
                {/* Tooltip */}
                <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md text-foreground px-3 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-elegant z-50">
                  {item.title}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-white/95 rotate-45" />
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
            className="group relative w-12 h-12 rounded-2xl p-0 text-white hover:bg-white/10 hover:backdrop-blur-md transition-all duration-500 hover:scale-110"
            title="Sair do Sistema"
          >
            <LogOut className="h-5 w-5 transition-all duration-300 group-hover:scale-110" />
            
            {/* Tooltip */}
            <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-md text-foreground px-3 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-elegant z-50">
              Sair do Sistema
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-white/95 rotate-45" />
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}