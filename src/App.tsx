
import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRouteSimple";
import LoadingSpinner from "./components/LoadingSpinner";
import { ConditionalNotificationListener } from "./components/ConditionalNotificationListener";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { AutoCacheCleaner } from "./components/AutoCacheCleaner";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from "./pages/AdminLayout";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth").then(module => ({ default: module.default })));
const NotFound = lazy(() => import("./pages/NotFound"));
const PendingApproval = lazy(() => import("./pages/PendingApproval").then(module => ({ default: module.PendingApproval })));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Welcome = lazy(() => import("./pages/Welcome"));
const FirstAccessSetup = lazy(() => import("./components/FirstAccessSetup").then(module => ({ default: module.FirstAccessSetup })));
const ImportMembers = lazy(() => import("./pages/admin/ImportMembers"));
const ConvertUsers = lazy(() => import("./pages/admin/ConvertUsers"));

// Admin pages
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Tickets = lazy(() => import("./pages/admin/Tickets"));
const Atendimentos = lazy(() => import("./pages/admin/Atendimentos"));
const Unidades = lazy(() => import("./pages/admin/Unidades"));
const Franqueados = lazy(() => import("./pages/admin/Franqueados"));
const Colaboradores = lazy(() => import("./pages/admin/Colaboradores"));
const Equipes = lazy(() => import("./pages/admin/Equipes"));
const Configuracoes = lazy(() => import("./pages/admin/Configuracoes"));
const Logs = lazy(() => import("./pages/admin/Logs"));
const Profile = lazy(() => import("./pages/admin/Profile"));
const Governanca = lazy(() => import("./pages/admin/Governanca"));

// Franqueado pages
const FranqueadoLayout = lazy(() => import("./pages/FranqueadoLayout"));
const FranqueadoDashboard = lazy(() => import("./pages/franqueado/Dashboard"));
const FranqueadoTickets = lazy(() => import("./pages/franqueado/Tickets"));
const FranqueadoUnidades = lazy(() => import("./pages/franqueado/Unidades"));
const FranqueadoProfile = lazy(() => import("./pages/franqueado/Profile"));

// Mobile pages
const MobileUnitTickets = lazy(() => import("./pages/mobile/UnitTickets"));
const MobileTicketChat = lazy(() => import("./pages/mobile/TicketChat"));

const queryClient = new QueryClient();

// Sistema de notificações simplificado
const TestNotifications = () => {
  useEffect(() => {
    console.log('🔔 🔔 🔔 SISTEMA DE NOTIFICAÇÕES CARREGADO!!!');
    
    // Inicializar o sistema de áudio
    import('@/lib/audio-manager').then(({ audioManager }) => {
      console.log('🔔 🎵 AudioManager carregado');
      console.log('🔔 🎵 Status:', audioManager.getStatus());
    });
    
    return () => {
      console.log('🔔 🧹 Sistema de notificações desmontado');
    };
  }, []);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <TestNotifications />
        <BrowserRouter>
          <ConditionalNotificationListener />
          <PWAInstallPrompt />
          <AutoCacheCleaner />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/first-access" element={<FirstAccessSetup />} />
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={
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
              <Route path="/admin/atendimentos" element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Atendimentos />
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
              <Route path="/admin/import-members" element={
                <ProtectedRoute requiredRoles={['admin', 'diretoria']}>
                  <AdminLayout>
                    <ImportMembers />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              <Route path="/admin/convert-users" element={
                <ProtectedRoute requiredRoles={['admin', 'diretoria']}>
                  <AdminLayout>
                    <ConvertUsers />
                  </AdminLayout>
                </ProtectedRoute>
              } />
              
              {/* Rotas do Franqueado */}
              <Route path="/franqueado" element={<Navigate to="/franqueado/dashboard" replace />} />
              <Route path="/franqueado/dashboard" element={
                <ProtectedRoute requiredRole="franqueado">
                  <FranqueadoLayout>
                    <FranqueadoDashboard />
                  </FranqueadoLayout>
                </ProtectedRoute>
              } />
              <Route path="/franqueado/tickets" element={
                <ProtectedRoute requiredRole="franqueado">
                  <FranqueadoLayout>
                    <FranqueadoTickets />
                  </FranqueadoLayout>
                </ProtectedRoute>
              } />
              <Route path="/franqueado/unidades" element={
                <ProtectedRoute requiredRole="franqueado">
                  <FranqueadoLayout>
                    <FranqueadoUnidades />
                  </FranqueadoLayout>
                </ProtectedRoute>
              } />
              <Route path="/franqueado/profile" element={
                <ProtectedRoute requiredRole="franqueado">
                  <FranqueadoLayout>
                    <FranqueadoProfile />
                  </FranqueadoLayout>
                </ProtectedRoute>
              } />
              
              {/* Mobile Routes - Públicas sem autenticação */}
              <Route path="/mobile/tickets" element={<MobileUnitTickets />} />
              <Route path="/mobile/tickets/:ticketId" element={<MobileTicketChat />} />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
