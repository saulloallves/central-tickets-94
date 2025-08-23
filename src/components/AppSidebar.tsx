import { 
  Users, 
  Building2, 
  UserCheck, 
  Ticket,
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
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { LogoUpload } from "@/components/LogoUpload";
import { SystemLogo } from "@/components/SystemLogo";

const navigationItems = [
  { title: "Dashboard", url: "/admin", icon: Home, permission: 'access_dashboards' as const },
  { title: "Tickets", url: "/admin/tickets", icon: Ticket, permission: 'view_own_unit_tickets' as const },
  { title: "Unidades", url: "/admin/unidades", icon: Building2, permission: 'view_all_tickets' as const },
  { title: "Franqueados", url: "/admin/franqueados", icon: Users, permission: 'view_all_tickets' as const },
  { title: "Colaboradores", url: "/admin/colaboradores", icon: UserCheck, permission: 'view_all_tickets' as const },
  { title: "Equipes", url: "/admin/equipes", icon: Users2, permission: 'view_all_tickets' as const },
  { title: "Permissões", url: "/admin/permissions", icon: Shield, permission: 'configure_ai_models' as const },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings, permission: 'configure_ai_models' as const },
  { title: "Governança", url: "/admin/governanca", icon: Shield, permission: 'view_audit_logs' as const },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleMouseEnter = () => {
    setIsExpanded(true);
    // Ajustar margin do conteúdo principal
    const mainContent = document.querySelector('[data-main-content]') as HTMLElement;
    if (mainContent) {
      mainContent.style.marginLeft = '208px'; // Fixo para simplicidade
    }
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
    // Restaurar margin original
    const mainContent = document.querySelector('[data-main-content]') as HTMLElement;
    if (mainContent) {
      mainContent.style.marginLeft = '80px'; // Fixo para simplicidade
    }
  };

  return (
    <div
      className={cn(
        "h-[calc(100vh-12rem)] fixed left-4 top-1/2 -translate-y-1/2 z-40 transition-all duration-150",
        isExpanded ? "w-48" : "w-16"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Modern liquid glass sidebar container */}
      <div className="relative h-full bg-gradient-to-b from-primary via-primary/95 to-primary/90 rounded-[32px] overflow-hidden">
        {/* Liquid glass overlay effect */}
        <div className="absolute inset-0 liquid-glass-sidebar"></div>
        
        {/* Curved right edge effect */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-3/4 z-10">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-l-full"></div>
        </div>
        
        {/* Content wrapper with padding for curves */}
        <div className="relative z-20 h-full flex flex-col py-4 px-2">
          {/* System Logo Section */}
          <div className="flex justify-center mb-4">
            <SystemLogo />
          </div>

          {/* Navigation Icons */}
          <div className="flex-1 flex flex-col space-y-2">
            {navigationItems.map((item) => (
              <PermissionGuard key={item.title} requiredPermission={item.permission}>
                {isExpanded ? (
                  // Expanded view with labels
                  <TooltipProvider delayDuration={0}>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) => cn(
                        "group flex items-center px-3 py-2 rounded-xl transition-all duration-450",
                        "hover:scale-[1.02]",
                        isActive 
                          ? "bg-white/10 backdrop-blur-sm text-white border border-white/20" 
                          : "hover:bg-white/5 hover:backdrop-blur-sm hover:text-white/95 hover:border hover:border-white/10"
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <div className="relative flex items-center justify-center w-6 h-6 mr-2">
                            <item.icon 
                               className={cn(
                                 "h-4 w-4 text-white transition-all duration-450 drop-shadow-md",
                                 isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "opacity-90"
                               )}
                              strokeWidth={1.5}
                            />
                            
                            {/* Active indicator - white glow dot */}
                            {isActive && (
                              <div className="absolute -right-0.5 -top-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse"></div>
                            )}
                          </div>
                          
                           <span className={cn(
                             "text-white text-sm font-medium transition-all duration-450 drop-shadow-md",
                             isActive ? "opacity-100" : "opacity-90"
                           )}>
                            {item.title}
                          </span>
                        </>
                      )}
                    </NavLink>
                  </TooltipProvider>
                ) : (
                  // Collapsed view with tooltips
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <NavLink
                          to={item.url}
                          end
                          className={({ isActive }) => cn(
                            "group relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl transition-all duration-450 mx-auto",
                            isActive 
                              ? "bg-white/10 backdrop-blur-sm text-white" 
                              : "hover:bg-white/5 hover:backdrop-blur-sm hover:text-white/95"
                          )}
                        >
                          {({ isActive }) => (
                            <>
                              <item.icon 
                                 className={cn(
                                   "h-3 w-3 sm:h-4 sm:w-4 text-white transition-all duration-450 drop-shadow-md",
                                   isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "opacity-90"
                                 )}
                                strokeWidth={1.5}
                              />
                              
                              {/* Active indicator - white glow dot */}
                              {isActive && (
                                <div className="absolute -top-1 -right-0.5 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse"></div>
                              )}
                            </>
                          )}
                        </NavLink>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="right" 
                        className="liquid-glass-card text-white ml-2"
                      >
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </PermissionGuard>
            ))}
          </div>

          {/* User Profile Section */}
          <div className="mt-4 space-y-2 flex-shrink-0">
            {isExpanded ? (
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen} modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="group w-full flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 text-white hover:bg-white/5 transition-all duration-450 rounded-lg sm:rounded-xl"
                  >
                     <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
                       <Avatar className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0">
                         <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                         <AvatarFallback className="bg-white/20 text-white text-[10px] sm:text-xs">
                           {profile?.nome_completo?.charAt(0)?.toUpperCase() ||
                            user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || 
                            user?.email?.charAt(0)?.toUpperCase() || 'U'}
                         </AvatarFallback>
                       </Avatar>
                       <div className="flex flex-col items-start min-w-0 flex-1">
                         <span className="text-[10px] sm:text-xs font-medium truncate w-full drop-shadow-md">
                           {profile?.nome_completo || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Usuário'}
                         </span>
                        <div className="flex items-center space-x-1">
                          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></div>
                          <span className="text-[8px] sm:text-[10px] opacity-70 drop-shadow-sm">Online</span>
                        </div>
                      </div>
                    </div>
                    <ChevronDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-60 flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  side="bottom" 
                  align="start"
                  className="z-[100] bg-white dark:bg-gray-900 shadow-2xl rounded-lg border border-gray-200 dark:border-gray-700 w-40 sm:w-48"
                  sideOffset={8}
                  avoidCollisions={true}
                >
                   <DropdownMenuItem asChild className="text-gray-700 dark:text-gray-200 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer">
                     <NavLink to="/admin/profile" className="flex items-center">
                       <User className="h-4 w-4 mr-2" />
                       Meu Perfil
                     </NavLink>
                   </DropdownMenuItem>
                   <DropdownMenuItem asChild className="text-gray-700 dark:text-gray-200 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer">
                     <NavLink to="/admin/profile" className="flex items-center">
                       <Settings className="h-4 w-4 mr-2" />
                       Configurações
                     </NavLink>
                   </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                  <DropdownMenuItem 
                    className="text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer" 
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair do Sistema
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                       <Avatar className="h-6 w-6 sm:h-8 sm:w-8 mx-auto cursor-pointer hover:scale-[1.02] transition-all duration-450">
                         <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                         <AvatarFallback className="bg-white/20 text-white text-[10px] sm:text-xs">
                           {profile?.nome_completo?.charAt(0)?.toUpperCase() ||
                            user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || 
                            user?.email?.charAt(0)?.toUpperCase() || 'U'}
                         </AvatarFallback>
                       </Avatar>
                       {/* Online status indicator */}
                       <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400 border border-white/50 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></div>
                     </div>
                   </TooltipTrigger>
                   <TooltipContent 
                     side="right" 
                     className="liquid-glass-card text-white ml-2"
                   >
                     {profile?.nome_completo || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Usuário'} • Online
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}