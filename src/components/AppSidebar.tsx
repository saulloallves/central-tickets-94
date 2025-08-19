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
  Activity
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "Unidades", url: "/admin/unidades", icon: Building2 },
  { title: "Franqueados", url: "/admin/franqueados", icon: Users },
  { title: "Colaboradores", url: "/admin/colaboradores", icon: UserCheck },
  { title: "Tickets", url: "/admin/tickets", icon: ClipboardList },
  { title: "Equipes", url: "/admin/equipes", icon: Users2 },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
  { title: "Logs & Auditoria", url: "/admin/logs", icon: Activity },
];

const colaboradorItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "Meus Tickets", url: "/admin/tickets", icon: ClipboardList },
];

export function AppSidebar() {
  const { signOut } = useAuth();
  const { isAdmin } = useRole();
  const location = useLocation();
  const currentPath = location.pathname;

  const items = isAdmin() ? adminItems : colaboradorItems;

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
          {items.map((item) => {
            const isActive = currentPath === item.url;
            return (
              <NavLink
                key={item.title}
                to={item.url}
                end
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </NavLink>
            );
          })}
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