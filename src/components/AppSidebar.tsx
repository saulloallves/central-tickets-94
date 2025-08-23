import * as React from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  FileText,
  Home,
  Settings,
  Shield,
  UserCheck,
  Users,
  Users2,
  Activity,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/hooks/useSidebar";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  permission:
    | "access_dashboards"
    | "view_own_unit_tickets"
    | "view_all_tickets"
    | "configure_ai_models";
}

const navigationItems: NavItem[] = [
  { title: "Dashboard", url: "/admin", icon: Home, permission: 'access_dashboards' as const },
  { title: "Tickets", url: "/admin/tickets", icon: Ticket, permission: 'view_own_unit_tickets' as const },
  { title: "Unidades", url: "/admin/unidades", icon: Building2, permission: 'view_all_tickets' as const },
  { title: "Franqueados", url: "/admin/franqueados", icon: Users, permission: 'view_all_tickets' as const },
  { title: "Colaboradores", url: "/admin/colaboradores", icon: UserCheck, permission: 'view_all_tickets' as const },
  { title: "Equipes", url: "/admin/equipes", icon: Users2, permission: 'view_all_tickets' as const },
  { title: "Governança", url: "/admin/governanca", icon: Activity, permission: 'configure_ai_models' as const },
  { title: "Permissões", url: "/admin/permissions", icon: Shield, permission: 'configure_ai_models' as const },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings, permission: 'configure_ai_models' as const },
  { title: "Logs", url: "/admin/logs", icon: FileText, permission: 'configure_ai_models' as const },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, setCollapsed } = useSidebar();
  const { hasPermission } = useAuth();

  useEffect(() => {
    const handleRouteChange = () => {
      if (collapsed) {
        setCollapsed(false);
      }
    };

    handleRouteChange();
  }, [location.pathname, collapsed, setCollapsed]);

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-muted border-r py-4",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="px-3 flex items-center justify-center">
        <h1 className={cn("text-2xl font-bold text-center", collapsed ? "hidden" : "block")}>
          GiraBot
        </h1>
      </div>
      <nav className="mt-6 px-2 flex-1">
        {navigationItems.map((item) => {
          if (!hasPermission(item.permission)) {
            return null;
          }

          return (
            <a
              key={item.url}
              href={item.url}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.url);
              }}
              className={cn(
                "flex items-center space-x-2 p-2 rounded-md hover:bg-secondary hover:text-accent transition-colors",
                location.pathname === item.url ? "bg-secondary text-accent" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className={cn(collapsed ? "hidden" : "block")}>
                {item.title}
              </span>
            </a>
          );
        })}
      </nav>
      <div className="p-4">
        <button
          className="flex items-center p-2 bg-secondary rounded-md hover:bg-accent hover:text-secondary-foreground transition-colors"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <span className="text-muted-foreground">Expandir</span>
          ) : (
            <span className="text-muted-foreground">Minimizar</span>
          )}
        </button>
      </div>
    </div>
  );
}
