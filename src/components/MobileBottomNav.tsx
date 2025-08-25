import { NavLink } from "react-router-dom";
import { navigationItems } from "@/constants/navigation";
import { PermissionGuard } from "@/components/PermissionGuard";
import { cn } from "@/lib/utils";
import { NotificationButton } from "@/components/notifications/NotificationButton";

export function MobileBottomNav() {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      {/* Mobile bottom navigation with liquid glass effect */}
      <div className="relative bg-gradient-to-r from-primary via-primary/95 to-primary/90 rounded-full overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/10">
        {/* Liquid glass overlay effect */}
        <div className="absolute inset-0 liquid-glass-sidebar rounded-full"></div>
        
        {/* Navigation container */}
        <div className="relative z-20 px-4 py-4">
          <div className="flex items-center justify-between space-x-2">
            {/* Navigation items - ALL items with horizontal scroll */}
            <div className="flex items-center space-x-2 flex-1 overflow-x-auto scrollbar-hide px-2">
              {navigationItems.map((item) => (
                <PermissionGuard key={item.title} requiredPermission={item.permission}>
                  <NavLink
                    to={item.url}
                    end
                    className={({ isActive }) => cn(
                      "relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 flex-shrink-0",
                      isActive 
                        ? "bg-white/10 backdrop-blur-sm text-white" 
                        : "hover:bg-white/5 hover:backdrop-blur-sm hover:text-white/95"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon 
                          className={cn(
                            "h-6 w-6 text-white transition-all duration-300 drop-shadow-md",
                            isActive ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "opacity-90"
                          )}
                          strokeWidth={1.5}
                        />
                        
                        {/* Active indicator */}
                        {isActive && (
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse"></div>
                        )}
                        
                        {/* Small label */}
                        <span className={cn(
                          "text-[10px] text-white font-medium mt-1 drop-shadow-md text-center",
                          isActive ? "opacity-100" : "opacity-70"
                        )}>
                          {item.title.length > 4 ? item.title.substring(0, 4) + '.' : item.title}
                        </span>
                      </>
                    )}
                  </NavLink>
                </PermissionGuard>
              ))}
            </div>
            
            {/* Notification button */}
            <div className="flex-shrink-0">
              <NotificationButton isExpanded={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}