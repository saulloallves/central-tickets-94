
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AdminLayout from "@/pages/AdminLayout";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/admin/Dashboard";
import Tickets from "@/pages/admin/Tickets";
import Equipes from "@/pages/admin/Equipes";
import Colaboradores from "@/pages/admin/Colaboradores";
import Unidades from "@/pages/admin/Unidades";
import Franqueados from "@/pages/admin/Franqueados";
import Configuracoes from "@/pages/admin/Configuracoes";
import Governanca from "@/pages/admin/Governanca";
import Logs from "@/pages/admin/Logs";
import Profile from "@/pages/admin/Profile";
import NotFound from "@/pages/NotFound";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Dashboard />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/profile" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Profile />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/tickets" element={
              <ProtectedRoute requiredPermission="view_all_tickets">
                <AdminLayout>
                  <Tickets />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/equipes" element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout>
                  <Equipes />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/colaboradores" element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout>
                  <Colaboradores />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/unidades" element={
              <ProtectedRoute requiredPermission="view_all_tickets">
                <AdminLayout>
                  <Unidades />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/franqueados" element={
              <ProtectedRoute requiredPermission="view_all_tickets">
                <AdminLayout>
                  <Franqueados />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/configuracoes" element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout>
                  <Configuracoes />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/governanca" element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout>
                  <Governanca />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/logs" element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout>
                  <Logs />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
          <SonnerToaster />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
