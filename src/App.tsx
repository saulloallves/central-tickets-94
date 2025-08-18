import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./pages/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Unidades from "./pages/admin/Unidades";
import Franqueados from "./pages/admin/Franqueados";
import Colaboradores from "./pages/admin/Colaboradores";

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
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            } />
            <Route path="/admin/unidades" element={
              <AdminLayout>
                <Unidades />
              </AdminLayout>
            } />
            <Route path="/admin/franqueados" element={
              <AdminLayout>
                <Franqueados />
              </AdminLayout>
            } />
            <Route path="/admin/colaboradores" element={
              <AdminLayout>
                <Colaboradores />
              </AdminLayout>
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
