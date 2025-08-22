import { 
  Users, 
  Building2, 
  UserCheck, 
  ClipboardList, 
  Settings, 
  LogOut,
  Home,
  Users2,
  Activity,
  Shield,
  ChevronRight,
  User,
  ChevronDown
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGuard } from "@/components/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleMouseEnter = () => {
    setIsExpanded(true);
    // Ajustar margin do conteúdo principal
    const mainContent = document.querySelector('[data-main-content]') as HTMLElement;
    if (mainContent) {
      mainContent.style.marginLeft = '208px'; // 16px (left) + 192px (expanded width)
    }
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
    // Restaurar margin original
    const mainContent = document.querySelector('[data-main-content]') as HTMLElement;
    if (mainContent) {
      mainContent.style.marginLeft = '80px'; // 80px original (mais próximo)
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div 
        className={cn(
          "h-[calc(100vh-12rem)] fixed left-4 top-1/2 -translate-y-1/2 z-40 transition-all duration-500",
          isExpanded ? "w-48" : "w-16"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Modern curved sidebar container */}
        <div className="
          relative h-full bg-gradient-sidebar shadow-glow backdrop-blur-xl
          rounded-t-[24px] rounded-b-[24px] overflow-hidden
          border border-white/20
          before:absolute before:top-0 before:right-0 before:w-8 before:h-1/3
          before:bg-gradient-to-l before:from-white/10 before:to-transparent
          before:rounded-bl-[40px]
          after:absolute after:bottom-0 after:right-0 after:w-8 before:h-1/3
          after:bg-gradient-to-l after:from-white/10 after:to-transparent
          after:rounded-tl-[40px]
        ">
          {/* Curved right edge effect */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-3/4">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-l-full"></div>
          </div>
          
          {/* Content wrapper with padding for curves */}
          <div className="relative z-10 h-full flex flex-col py-4 px-2">
            {/* Main logo/brand icon */}
            <div className="flex justify-center mb-4">
              <div className="w-8 h-8 flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-white" strokeWidth={1.5} />
              </div>
            </div>

            {/* Navigation Icons */}
            <div className="flex-1 flex flex-col space-y-2">
              {navigationItems.map((item) => (
                <PermissionGuard key={item.title} requiredPermission={item.permission}>
                  {isExpanded ? (
                    // Expanded view with labels
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) => cn(
                        "group flex items-center px-3 py-2 transition-all duration-300",
                        "hover:scale-[1.02]",
                        isActive 
                          ? "bg-white/25 backdrop-blur-md border border-white/20 shadow-neumorphic rounded-xl" 
                          : ""
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <div className="relative flex items-center justify-center w-6 h-6 mr-2">
                            <item.icon 
                              className={cn(
                                "h-4 w-4 text-white transition-all duration-300",
                                isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "opacity-80"
                              )} 
                              strokeWidth={1.5}
                            />
                            
                            {/* Active indicator - green dot */}
                            {isActive && (
                              <div className="absolute -right-0.5 -top-2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse"></div>
                            )}
                          </div>
                          
                          <span className={cn(
                            "text-white text-sm font-medium transition-all duration-300",
                            isActive ? "opacity-100" : "opacity-80"
                          )}>
                            {item.title}
                          </span>
                        </>
                      )}
                    </NavLink>
                  ) : (
                    // Collapsed view with tooltips
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={item.url}
                          end
                          className={({ isActive }) => cn(
                            "group relative flex items-center justify-center w-10 h-10 transition-all duration-300 mx-auto",
                            isActive 
                              ? "bg-white/25 scale-[1.02] rounded-xl hover:scale-[1.02]" 
                              : "hover:scale-[1.02]"
                          )}
                        >
                          {({ isActive }) => (
                            <>
                              <item.icon 
                                className={cn(
                                  "h-4 w-4 text-white transition-all duration-300",
                                  isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "opacity-80"
                                )} 
                                strokeWidth={1.5}
                              />
                              
                              {/* Active indicator - green dot */}
                              {isActive && (
                                <div className="absolute -top-1 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse"></div>
                              )}
                            </>
                          )}
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="right" 
                        className="bg-white/95 backdrop-blur-md text-gray-800 shadow-elegant rounded-xl border border-white/20 ml-2"
                      >
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </PermissionGuard>
              ))}
            </div>

            {/* User Profile Section */}
            <div className="mt-4 space-y-2">
              {isExpanded ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="group w-full flex items-center justify-between px-3 py-2 text-white hover:bg-white/10 hover:scale-[1.02] transition-all duration-300 rounded-xl"
                    >
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user?.user_metadata?.avatar_url} />
                          <AvatarFallback className="bg-white/20 text-white text-xs">
                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-xs font-medium truncate max-w-20">
                            {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Usuário'}
                          </span>
                          <div className="flex items-center space-x-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]"></div>
                            <span className="text-[10px] opacity-70">Online</span>
                          </div>
                        </div>
                      </div>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    side="right" 
                    className="bg-white/95 backdrop-blur-md shadow-elegant rounded-xl border border-white/20 ml-2"
                  >
                    <DropdownMenuItem className="text-gray-800">
                      <User className="h-4 w-4 mr-2" />
                      Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-gray-800">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair do Sistema
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Avatar className="h-8 w-8 mx-auto cursor-pointer hover:scale-[1.02] transition-all duration-300">
                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                        <AvatarFallback className="bg-white/20 text-white text-xs">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online status indicator */}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white/50 shadow-[0_0_4px_rgba(16,185,129,0.6)]"></div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="right" 
                    className="bg-white/95 backdrop-blur-md text-gray-800 shadow-elegant rounded-xl border border-white/20 ml-2"
                  >
                    {user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Usuário'} • Online
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}