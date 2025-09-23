import { 
  Users, 
  Building2, 
  UserCheck, 
  Ticket,
  MessageSquare,
  Settings, 
  Home,
  Users2,
  BarChart3
} from "lucide-react";

export const navigationItems = [
  { title: "Dashboard", url: "/admin", icon: Home, permission: 'access_dashboards' as const },
  { title: "Tickets", url: "/admin/tickets", icon: Ticket, permission: 'view_team_tickets' as const },
  { title: "Atendimentos", url: "/admin/atendimentos", icon: MessageSquare, requireAtendente: true },
  { title: "Unidades", url: "/admin/unidades", icon: Building2, permission: 'view_team_tickets' as const },
  { title: "Franqueados", url: "/admin/franqueados", icon: Users, permission: 'view_team_tickets' as const },
  { title: "Colaboradores", url: "/admin/colaboradores", icon: UserCheck, permission: 'view_all_tickets' as const },
  { title: "Equipes", url: "/admin/equipes", icon: Users2, permission: 'view_team_tickets' as const },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings, permission: 'configure_ai_models' as const },
  { title: "Central de Controle", url: "/admin/governanca", icon: BarChart3, permission: 'view_audit_logs' as const },
];