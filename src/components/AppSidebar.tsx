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
    <div className="w-72 h-screen bg-sidebar border-r border-sidebar-border flex flex-col backdrop-blur-lg fixed left-0 top-0 z-40 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border bg-gradient-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-sidebar-foreground">HelpDesk AI</h2>
            <p className="text-xs text-sidebar-foreground/60">Gestão Inteligente</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-2">
          <p className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider px-3 py-2 mb-4">
            Menu Principal
          </p>
          {navigationItems.map((item) => (
            <PermissionGuard key={item.title} requiredPermission={item.permission}>
              <NavLink
                to={item.url}
                end
                className={({ isActive }) => cn(
                  "group flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 hover:bg-sidebar-accent/50 hover:shadow-card",
                  isActive && "bg-gradient-primary text-white shadow-glow hover:bg-gradient-primary"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </div>
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </NavLink>
            </PermissionGuard>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border bg-gradient-subtle flex-shrink-0">
        <Button 
          variant="ghost" 
          onClick={handleSignOut}
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-destructive transition-all duration-200 rounded-xl"
        >
          <LogOut className="h-4 w-4" />
          Sair do Sistema
        </Button>
      </div>
    </div>
  );
}