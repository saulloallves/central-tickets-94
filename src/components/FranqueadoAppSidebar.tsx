import { 
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { SystemLogo } from "@/components/SystemLogo";
import { franqueadoNavigationItems } from "@/constants/franqueadoNavigation";
import { useIsMobile } from "@/hooks/use-mobile";

export function FranqueadoAppSidebar() {
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleMouseEnter = () => {
    setIsExpanded(true);
    // Ajustar margin do conteúdo principal apenas no desktop
    if (!isMobile) {
      const mainContent = document.querySelector('[data-main-content]') as HTMLElement;
      if (mainContent) {
        mainContent.style.marginLeft = '240px';
      }
    }
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
    // Restaurar margin original apenas no desktop
    if (!isMobile) {
      const mainContent = document.querySelector('[data-main-content]') as HTMLElement;
      if (mainContent) {
        mainContent.style.marginLeft = '80px';
      }
    }
  };

  return (
    <div
      className={cn(
        "fixed left-4 top-1/2 -translate-y-1/2 z-40 transition-all duration-300",
        // No desktop: sempre vertical, altura menor
        "h-[calc(100vh-16rem)]",
        isExpanded ? "w-56" : "w-16"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Modern liquid glass sidebar container */}
      <div className="relative h-full bg-gradient-to-b from-primary via-primary/95 to-primary/90 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/10">
        {/* Liquid glass overlay effect */}
        <div className="absolute inset-0 liquid-glass-sidebar rounded-3xl"></div>
        
        {/* Content wrapper - sempre vertical no desktop */}
        <div className={cn(
          "relative z-20 h-full flex flex-col overflow-hidden",
          isExpanded ? "py-6 px-4" : "py-4 px-2"
        )}>
          {/* System Logo Section */}
          <div className="flex justify-center mb-4">
            <SystemLogo />
          </div>

          {/* Navigation Icons - sempre vertical */}
          <div className="flex-1 flex flex-col space-y-1 overflow-y-auto scrollbar-hide py-2">
            {franqueadoNavigationItems.map((item) => (
              <TooltipProvider key={item.title} delayDuration={200}>
                {isExpanded ? (
                  <NavLink
                    to={item.url}
                    end
                    className={({ isActive }) => cn(
                      "group flex items-center px-3 py-2 rounded-xl transition-all duration-300",
                      "hover:scale-[1.02]",
                      isActive 
                        ? "bg-white/10 backdrop-blur-sm text-white border border-white/20" 
                        : "hover:bg-white/5 hover:backdrop-blur-sm hover:text-white/95"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <div className="relative flex items-center justify-center w-6 h-6 mr-3">
                          <item.icon 
                             className={cn(
                               "h-5 w-5 text-white transition-all duration-300 drop-shadow-md",
                               isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "opacity-90"
                             )}
                            strokeWidth={1.5}
                          />
                          {isActive && (
                            <div className="absolute -right-1 -top-1 w-1.5 h-1.5 rounded-full bg-white shadow-sm"></div>
                          )}
                        </div>
                        <span className={cn(
                          "text-white text-sm font-medium transition-all duration-300 drop-shadow-md",
                          isActive ? "opacity-100" : "opacity-90"
                        )}>
                          {item.title}
                        </span>
                      </>
                    )}
                  </NavLink>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) => cn(
                          "group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 mx-auto",
                          isActive 
                            ? "bg-white/10 backdrop-blur-sm text-white" 
                            : "hover:bg-white/5 hover:backdrop-blur-sm hover:text-white/95"
                        )}
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon 
                               className={cn(
                                 "h-5 w-5 text-white transition-all duration-300 drop-shadow-md",
                                 isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "opacity-90"
                               )}
                              strokeWidth={1.5}
                            />
                            {isActive && (
                              <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-white shadow-sm"></div>
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
                )}
              </TooltipProvider>
            ))}
          </div>

          {/* Bottom Section - sempre vertical */}
          <div className="flex flex-col space-y-2 mt-auto">
            {/* User Profile Section */}
            <div className="flex justify-center">
            {isExpanded ? (
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen} modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="group w-full flex items-center justify-between px-4 py-3 text-white hover:bg-white/5 transition-all duration-450 rounded-xl"
                  >
                     <div className="flex items-center space-x-3 min-w-0">
                       <Avatar className="h-8 w-8 flex-shrink-0">
                         <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                          <AvatarFallback className="bg-white/20 text-white text-sm">
                            {profile?.nome_completo?.charAt(0)?.toUpperCase() ||
                             user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || 
                             user?.email?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span className="text-sm font-medium truncate w-full drop-shadow-md">
                            {profile?.nome_completo || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Usuário'}
                          </span>
                         <div className="flex items-center space-x-1">
                           <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></div>
                           <span className="text-xs opacity-70 drop-shadow-sm">Online</span>
                         </div>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-60 flex-shrink-0" />
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
                     <NavLink to="/franqueado/profile" className="flex items-center">
                       <User className="h-4 w-4 mr-2" />
                       Meu Perfil
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
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                     <div className="relative">
                        <Avatar className="h-8 w-8 mx-auto cursor-pointer hover:scale-[1.02] transition-all duration-450">
                          <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                          <AvatarFallback className="bg-white/20 text-white text-sm">
                            {profile?.nome_completo?.charAt(0)?.toUpperCase() ||
                             user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || 
                             user?.email?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online status indicator */}
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white/50 shadow-[0_0_4px_rgba(34,197,94,0.6)]"></div>
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
    </div>
  );
}