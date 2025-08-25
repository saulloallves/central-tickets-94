import { 
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGuard } from "@/components/PermissionGuard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { SystemLogo } from "@/components/SystemLogo";
import { NotificationButton } from "@/components/notifications/NotificationButton";
import { navigationItems } from "@/constants/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const { state, open } = useSidebar();
  const collapsed = !open;

  const handleSignOut = async () => {
    await signOut();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar className="liquid-glass-sidebar border-r border-white/10">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-center">
          <SystemLogo />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/70 text-xs uppercase tracking-wider px-4 py-2">
            Navegação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <PermissionGuard key={item.title} requiredPermission={item.permission}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) => cn(
                          "group flex items-center px-3 py-2 rounded-lg transition-all duration-300",
                          "text-white hover:bg-white/10",
                          isActive 
                            ? "bg-white/15 backdrop-blur-sm border border-white/20" 
                            : "hover:bg-white/5"
                        )}
                      >
                        {({ isActive }) => (
                          <>
                            <div className="relative flex items-center justify-center w-5 h-5 mr-3">
                              <item.icon 
                                className={cn(
                                  "h-5 w-5 transition-all duration-300",
                                  isActive ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "text-white/90"
                                )}
                                strokeWidth={1.5}
                              />
                              {isActive && (
                                <div className="absolute -right-1 -top-1 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] animate-pulse"></div>
                              )}
                            </div>
                            {!collapsed && (
                              <span className={cn(
                                "text-sm font-medium transition-all duration-300",
                                isActive ? "text-white" : "text-white/90"
                              )}>
                                {item.title}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </PermissionGuard>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        {/* Notifications */}
        <div className="flex justify-center">
          <NotificationButton isExpanded={!collapsed} />
        </div>

        {/* User Profile */}
        {!collapsed ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-white/5 transition-all duration-300 cursor-pointer">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-white/20 text-white text-sm">
                    {profile?.nome_completo?.charAt(0)?.toUpperCase() ||
                     user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || 
                     user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-medium text-white truncate w-full">
                    {profile?.nome_completo || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Usuário'}
                  </span>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></div>
                    <span className="text-xs text-white/70">Online</span>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-white/60 flex-shrink-0" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              side="right" 
              align="end"
              className="bg-background border shadow-xl w-48"
              sideOffset={8}
            >
              <DropdownMenuItem asChild>
                <NavLink to="/admin/profile" className="flex items-center cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Meu Perfil
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive cursor-pointer" 
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair do Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-10 w-10 cursor-pointer hover:scale-105 transition-all duration-300">
                <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-white/20 text-white text-sm">
                  {profile?.nome_completo?.charAt(0)?.toUpperCase() ||
                   user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || 
                   user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-white/50 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}