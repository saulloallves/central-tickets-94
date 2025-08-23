
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarProvider } from "@/hooks/useSidebar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminLayout from "./pages/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Tickets from "./pages/admin/Tickets";
import Unidades from "./pages/admin/Unidades";
import Franqueados from "./pages/admin/Franqueados";
import Colaboradores from "./pages/admin/Colaboradores";
import Equipes from "./pages/admin/Equipes";
import Governanca from "./pages/admin/Governanca";
import PermissionsControl from "./pages/admin/PermissionsControl";
import Configuracoes from "./pages/admin/Configuracoes";
import Logs from "./pages/admin/Logs";
import Profile from "./pages/admin/Profile";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SidebarProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Index />} />
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <AdminLayout>
                      <Outlet />
                    </AdminLayout>
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="tickets" element={<Tickets />} />
                  <Route path="unidades" element={<Unidades />} />
                  <Route path="franqueados" element={<Franqueados />} />
                  <Route path="colaboradores" element={<Colaboradores />} />
                  <Route path="equipes" element={<Equipes />} />
                  <Route path="governanca" element={<Governanca />} />
                  <Route path="permissions" element={<PermissionsControl />} />
                  <Route path="configuracoes" element={<Configuracoes />} />
                  <Route path="logs" element={<Logs />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SidebarProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
