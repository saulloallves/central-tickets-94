import { BarChart3, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { PermissionGuard } from "@/components/PermissionGuard";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { useSystemLogs } from "@/hooks/useSystemLogs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RealtimeDashboard } from "@/components/governanca/RealtimeDashboard";
import { AuditPanel } from "@/components/governanca/AuditPanel";
import { BottleneckDetection } from "@/components/governanca/BottleneckDetection";
import { UsageReports } from "@/components/governanca/UsageReports";
import { AccessPermissionsControl } from "@/components/governanca/AccessPermissionsControl";
import { MetricsSection } from "@/components/governanca/MetricsSection";

export default function Governanca() {
  const { isAdmin } = useRole();
  const { user } = useAuth();
  const { logSystemAction } = useSystemLogs();
  const [periodFilter, setPeriodFilter] = useState("30");

  const periodOptions = [
    { value: "1", label: "Hoje" },
    { value: "7", label: "7 dias" },
    { value: "30", label: "30 dias" },
    { value: "0", label: "Todos" }
  ];

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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Central de Controle</h1>
                <p className="text-muted-foreground">Central de controle e análise estratégica do sistema</p>
              </div>
              <Badge variant="secondary">
                Admin Only
              </Badge>
            </div>
            
            {/* Period Filter */}
            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[140px] liquid-glass-button">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <span>Acessos & Permissões</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tempo-real" className="space-y-6">
            <RealtimeDashboard periodDays={parseInt(periodFilter)} />
          </TabsContent>

          <TabsContent value="metricas" className="space-y-6">
            <MetricsSection periodDays={parseInt(periodFilter)} />
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
            <AccessPermissionsControl />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
}