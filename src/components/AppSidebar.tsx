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
  Shield
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
    <div className="w-64 h-screen bg-background border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground">Sistema de Tickets</h2>
        <p className="text-sm text-muted-foreground">Gestão Administrativa</p>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
            Navegação
          </p>
          {navigationItems.map((item) => (
            <PermissionGuard key={item.title} requiredPermission={item.permission}>
              <NavLink
                to={item.url}
                end
                className={({ isActive }) => cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </NavLink>
            </PermissionGuard>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button 
          variant="ghost" 
          onClick={handleSignOut}
          className="w-full justify-start gap-3 text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}