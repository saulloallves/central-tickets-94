import { 
  Users, 
  Building2, 
  UserCheck, 
  ClipboardList, 
  Settings, 
  LogOut,
  Home,
  Users2
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: Home },
  { title: "Unidades", url: "/admin/unidades", icon: Building2 },
  { title: "Franqueados", url: "/admin/franqueados", icon: Users },
  { title: "Colaboradores", url: "/admin/colaboradores", icon: UserCheck },
  { title: "Tickets", url: "/admin/tickets", icon: ClipboardList },
  { title: "Equipes", url: "/admin/equipes", icon: Users2 },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
  { title: "Auditoria", url: "/admin/audit", icon: Settings },
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
  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-sidebar-accent/50";

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="text-sidebar-foreground">
          <h2 className="text-lg font-semibold">Sistema de Tickets</h2>
          <p className="text-sm text-sidebar-foreground/70">Gestão Administrativa</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Button 
          variant="ghost" 
          onClick={handleSignOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}