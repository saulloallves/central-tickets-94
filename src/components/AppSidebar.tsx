
import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  Home,
  Users,
  Building,
  Settings,
  TicketIcon,
  UserCheck,
  Shield,
  FileText,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Globe,
  Brain,
  BookOpen,
  AlertTriangle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useRole } from "@/hooks/useRole"
import { usePermissions } from "@/hooks/usePermissions"
import { useAuth } from "@/hooks/useAuth"
import { SystemLogo } from "./SystemLogo"

const navigationItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: Home,
    exact: true,
    requiresRole: null,
    requiresPermission: null,
  },
  {
    title: "Tickets",
    url: "/admin/tickets",
    icon: TicketIcon,
    requiresRole: null,
    requiresPermission: "view_all_tickets",
  },
  {
    title: "Equipes",
    url: "/admin/equipes",
    icon: Users,
    requiresRole: "admin",
    requiresPermission: null,
  },
  {
    title: "Colaboradores",
    url: "/admin/colaboradores",
    icon: UserCheck,
    requiresRole: "admin",
    requiresPermission: null,
  },
  {
    title: "Unidades",
    url: "/admin/unidades",
    icon: Building,
    requiresRole: null,
    requiresPermission: "view_all_tickets",
  },
  {
    title: "Franqueados",
    url: "/admin/franqueados",
    icon: Globe,
    requiresRole: null,
    requiresPermission: "view_all_tickets",
  },
  {
    title: "Configurações",
    url: "/admin/configuracoes",
    icon: Settings,
    requiresRole: "admin",
    requiresPermission: null,
  },
  {
    title: "Governança",
    url: "/admin/governanca",
    icon: Shield,
    requiresRole: "admin",
    requiresPermission: null,
  },
  {
    title: "Logs",
    url: "/admin/logs",
    icon: FileText,
    requiresRole: "admin",
    requiresPermission: null,
  },
]

export function AppSidebar() {
  const location = useLocation()
  const { user } = useAuth()
  const { isAdmin, isGerente, isDiretor } = useRole()
  const { hasPermission } = usePermissions()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    )
  }

  const hasAccess = (item: any) => {
    // If no role or permission required, allow access
    if (!item.requiresRole && !item.requiresPermission) {
      return true
    }

    // Check role requirement
    if (item.requiresRole) {
      switch (item.requiresRole) {
        case "admin":
          return isAdmin
        case "gerente":
          return isGerente || isAdmin
        case "diretor":
          return isDiretor || isAdmin
        default:
          return false
      }
    }

    // Check permission requirement
    if (item.requiresPermission) {
      return hasPermission(item.requiresPermission)
    }

    return false
  }

  const filteredNavigation = navigationItems.filter(hasAccess)

  return (
    <Sidebar variant="floating" className="border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarHeader className="border-b border-border/40">
        <div className="flex items-center gap-2 px-4 py-2">
          <SystemLogo />
          <div className="flex flex-col">
            <span className="text-lg font-bold text-foreground">Sistema</span>
            <span className="text-xs text-muted-foreground">Gestão</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="flex-1 px-2">
          <SidebarMenu>
            {filteredNavigation.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <Link
                    to={item.url}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      (item.exact ? location.pathname === item.url : location.pathname.startsWith(item.url))
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/40">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Administrador" : isGerente ? "Gerente" : isDiretor ? "Diretor" : "Colaborador"}
              </p>
            </div>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
