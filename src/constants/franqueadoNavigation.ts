import { 
  LayoutDashboard,
  Ticket,
  Building2,
  UserCog
} from "lucide-react";

export const franqueadoNavigationItems = [
  {
    title: "Dashboard",
    url: "/franqueado/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Tickets",
    url: "/franqueado/tickets", 
    icon: Ticket,
  },
  {
    title: "Unidades",
    url: "/franqueado/unidades",
    icon: Building2,
  },
  {
    title: "Perfil",
    url: "/franqueado/profile",
    icon: UserCog,
  },
];