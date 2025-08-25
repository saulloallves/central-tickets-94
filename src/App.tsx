
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Tickets from "./pages/admin/Tickets";
import Unidades from "./pages/admin/Unidades";
import Franqueados from "./pages/admin/Franqueados";
import Colaboradores from "./pages/admin/Colaboradores";
import Equipes from "./pages/admin/Equipes";
import Configuracoes from "./pages/admin/Configuracoes";
import Logs from "./pages/admin/Logs";

import Profile from "./pages/admin/Profile";
import Governanca from "./pages/admin/Governanca";
import FranqueadoLayout from "./pages/FranqueadoLayout";
import FranqueadoDashboard from "./pages/franqueado/Dashboard";
import { ProtectedRoute } from "./components/ProtectedRouteSimple";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            <Route path="/admin/tickets" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Tickets />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/unidades" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Unidades />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/franqueados" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Franqueados />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/colaboradores" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Colaboradores />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/equipes" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Equipes />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/configuracoes" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Configuracoes />
                </AdminLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin/logs" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Logs />
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
            <Route path="/admin/governanca" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Governanca />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            {/* Rotas do Franqueado */}
            <Route path="/franqueado" element={
              <ProtectedRoute requiredRole="franqueado">
                <FranqueadoLayout>
                  <FranqueadoDashboard />
                </FranqueadoLayout>
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
