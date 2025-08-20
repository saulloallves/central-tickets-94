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
    <div className="w-72 h-screen bg-gradient-sidebar border-r border-sidebar-border flex flex-col backdrop-blur-lg fixed left-0 top-0 z-40 overflow-hidden rounded-r-3xl shadow-elegant">
      {/* Header */}
      <div className="p-8 border-b border-sidebar-border/30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-glow">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-sidebar-foreground">HelpDesk AI</h2>
            <p className="text-sm text-sidebar-foreground/80">Gestão Inteligente</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-sidebar-foreground/80 uppercase tracking-wider px-4 py-3 mb-6">
            Menu Principal
          </p>
          {navigationItems.map((item) => (
            <PermissionGuard key={item.title} requiredPermission={item.permission}>
              <NavLink
                to={item.url}
                end
                className={({ isActive }) => cn(
                  "group flex items-center justify-between rounded-2xl px-4 py-4 text-sm font-medium transition-all duration-300 hover:bg-white/10 hover:backdrop-blur-md",
                  isActive && "bg-white/20 text-white shadow-neumorphic backdrop-blur-md"
                )}
              >
                <div className="flex items-center gap-4">
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate font-medium">{item.title}</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-80 transition-all duration-300" />
              </NavLink>
            </PermissionGuard>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-sidebar-border/30 flex-shrink-0">
        <Button 
          variant="ghost" 
          onClick={handleSignOut}
          className="w-full justify-start gap-4 text-sidebar-foreground hover:bg-white/10 hover:backdrop-blur-md hover:text-red-300 transition-all duration-300 rounded-2xl py-4 font-medium"
        >
          <LogOut className="h-5 w-5" />
          Sair do Sistema
        </Button>
      </div>
    </div>
  );
}