import { BarChart3 } from "lucide-react";
import { useEffect } from "react";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useSystemLogs } from "@/hooks/useSystemLogs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RealtimeDashboard } from "@/components/governanca/RealtimeDashboard";
import { AuditPanel } from "@/components/governanca/AuditPanel";
import { BottleneckDetection } from "@/components/governanca/BottleneckDetection";
import { UsageReports } from "@/components/governanca/UsageReports";
import { AccessControl } from "@/components/governanca/AccessControl";
import { PermissionsControl } from "@/components/governanca/PermissionsControl";
import { MetricsSection } from "@/components/governanca/MetricsSection";

export default function Governanca() {
  const { isAdmin } = useRole();
  const { user } = useAuth();
  const { logSystemAction } = useSystemLogs();

  useEffect(() => {
    if (user && isAdmin) {
      // Log access to governance module
      logSystemAction({
        tipo_log: 'acao_humana',
        entidade_afetada: 'governanca',
        entidade_id: 'painel_governanca',
        acao_realizada: 'Acesso ao módulo de Monitoramento & Governança'
      });
    }
  }, [user, isAdmin, logSystemAction]);

  // Dupla proteção: PermissionGuard + verificação manual de admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="liquid-glass-card">
          <CardContent className="p-8">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-8 w-8 text-critical" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Acesso Negado</h3>
                <p className="text-muted-foreground">Este módulo é exclusivo para administradores.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PermissionGuard requiredPermission="view_audit_logs" fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Card className="liquid-glass-card">
          <CardContent className="p-8">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-8 w-8 text-critical" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Acesso Restrito</h3>
                <p className="text-muted-foreground">Você não tem permissão para acessar este módulo.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="liquid-glass-header p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Monitoramento & Governança</h1>
              <p className="text-muted-foreground">Central de controle e análise estratégica do sistema</p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              Admin Only
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="tempo-real" className="space-y-6">
          <TabsList className="liquid-glass-card p-2">
            <TabsTrigger value="tempo-real" className="flex items-center space-x-2">
              <span>Tempo Real</span>
            </TabsTrigger>
            <TabsTrigger value="metricas" className="flex items-center space-x-2">
              <span>Métricas</span>
            </TabsTrigger>
            <TabsTrigger value="auditoria" className="flex items-center space-x-2">
              <span>Auditoria</span>
            </TabsTrigger>
            <TabsTrigger value="gargalos" className="flex items-center space-x-2">
              <span>Gargalos</span>
            </TabsTrigger>
            <TabsTrigger value="uso-sistema" className="flex items-center space-x-2">
              <span>Uso do Sistema</span>
            </TabsTrigger>
            <TabsTrigger value="acessos" className="flex items-center space-x-2">
              <span>Acessos & Sessões</span>
            </TabsTrigger>
            <TabsTrigger value="permissoes" className="flex items-center space-x-2">
              <span>Controle de Permissões</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tempo-real" className="space-y-6">
            <RealtimeDashboard />
          </TabsContent>

          <TabsContent value="metricas" className="space-y-6">
            <MetricsSection />
          </TabsContent>

          <TabsContent value="auditoria" className="space-y-6">
            <AuditPanel />
          </TabsContent>

          <TabsContent value="gargalos" className="space-y-6">
            <BottleneckDetection />
          </TabsContent>

          <TabsContent value="uso-sistema" className="space-y-6">
            <UsageReports />
          </TabsContent>

          <TabsContent value="acessos" className="space-y-6">
            <AccessControl />
          </TabsContent>

          <TabsContent value="permissoes" className="space-y-6">
            <PermissionsControl />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}