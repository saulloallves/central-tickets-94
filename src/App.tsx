
import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRouteSimple";
import LoadingSpinner from "./components/LoadingSpinner";
import { GlobalNotificationListener } from "./components/GlobalNotificationListener";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth").then(module => ({ default: module.default })));
const NotFound = lazy(() => import("./pages/NotFound"));
const PendingApproval = lazy(() => import("./pages/PendingApproval").then(module => ({ default: module.PendingApproval })));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Admin pages
const AdminLayout = lazy(() => import("./pages/AdminLayout"));
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

const queryClient = new QueryClient();

// Sistema de notificações sempre ativo
const RealtimeNotificationSystem = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) {
      console.log('🔔 📴 Usuario não logado - notificações desabilitadas');
      return;
    }

    console.log('🔔 🚀 SISTEMA DE NOTIFICAÇÕES INICIADO PARA:', user.id);
    console.log('🔔 📡 Configurando escuta em tempo real para TODAS as notificações...');

    // Canal principal para notificações internas (mais importante)
    const internalChannel = supabase
      .channel(`app-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_notification_recipients',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('🔔 🎯 NOTIFICAÇÃO INTERCEPTADA NO APP!', payload);
          
          try {
            // Buscar detalhes completos da notificação
            const { data: notification } = await supabase
              .from('internal_notifications')
              .select('*')
              .eq('id', payload.new.notification_id)
              .single();

            if (notification) {
              console.log('🔔 ✅ Notificação processada:', notification);
              
              // Toast específico para franqueado respondeu
              if (notification.type === 'franqueado_respondeu') {
                toast({
                  title: "💬 Franqueado Respondeu!",
                  description: notification.message || "Nova resposta recebida",
                  duration: 6000,
                });
                
                // Som de notificação
                try {
                  const audio = new Audio('/notification-sound.mp3');
                  audio.volume = 0.8;
                  audio.play().catch(e => console.log('🔔 ❌ Erro no som:', e));
                } catch (e) {
                  console.log('🔔 ❌ Erro ao criar audio:', e);
                }
              } else {
                // Toast genérico para outros tipos
                toast({
                  title: "🔔 Nova Notificação",
                  description: notification.title || notification.message || "Você tem uma nova notificação",
                  duration: 5000,
                });
              }
            }
          } catch (error) {
            console.error('🔔 ❌ Erro ao processar notificação:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications_queue',
          filter: `status=eq.pending`
        },
        (payload) => {
          console.log('🔔 📬 Notificação da fila interceptada:', payload);
          
          const { type, payload: notificationPayload } = payload.new;
          
          if (type === 'sla_breach') {
            toast({
              title: '🚨 SLA Vencido!',
              description: `Ticket ${notificationPayload?.codigo_ticket} teve o SLA vencido`,
              variant: 'destructive',
              duration: 8000,
            });
          } else if (type === 'crisis') {
            toast({
              title: '🔥 Crise Detectada!',
              description: `Ticket ${notificationPayload?.codigo_ticket} foi marcado como crise`,
              variant: 'destructive',
              duration: 8000,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 📡 STATUS CONEXÃO PRINCIPAL:', status);
        if (status === 'SUBSCRIBED') {
          console.log('🔔 ✅ SISTEMA DE NOTIFICAÇÕES CONECTADO COM SUCESSO!');
        } else if (status === 'CLOSED') {
          console.log('🔔 ❌ CONEXÃO PERDIDA! Tentando reconectar...');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('🔔 ⚠️ ERRO NO CANAL! Verificar configuração...');
        }
      });

    return () => {
      console.log('🔔 🧹 Limpando sistema de notificações para:', user.id);
      supabase.removeChannel(internalChannel);
    };
  }, [user?.id, toast]);

  return null; // Componente invisível
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <RealtimeNotificationSystem />
        <GlobalNotificationListener />
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/pending-approval" element={<PendingApproval />} />
                <Route path="/reset-password" element={<ResetPassword />} />
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
