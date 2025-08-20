
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KPICard } from "@/components/dashboard/KPICard";
import { AlertsPanel } from "@/components/admin/AlertsPanel";
import { CrisisPanel } from "@/components/crisis/CrisisPanel";
import { TicketDetail } from "@/components/tickets/TicketDetail";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { 
  TicketIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  AlertTriangleIcon,
  TrendingUpIcon,
  UsersIcon
} from "lucide-react";

const Dashboard = () => {
  const { kpis, loading } = useDashboardMetrics();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  
  // Listen for notification ticket modal events
  useEffect(() => {
    const handleOpenTicketModal = (event: CustomEvent) => {
      setSelectedTicketId(event.detail.ticketId);
    };
    
    window.addEventListener('openTicketModal', handleOpenTicketModal as EventListener);
    
    return () => {
      window.removeEventListener('openTicketModal', handleOpenTicketModal as EventListener);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema de tickets
          </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-gray-300 rounded w-20"></div>
                <div className="h-4 w-4 bg-gray-300 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-300 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema de tickets e gestão de crises
        </p>
      </div>

      {/* Crisis Management Panel - Priority position */}
      <CrisisPanel />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total de Tickets"
          value={kpis?.total_tickets?.toString() || "0"}
          description="Todos os tickets no sistema"
          icon={<TicketIcon className="h-4 w-4 text-info" />}
        />
        <KPICard
          title="Tickets Resolvidos"
          value={kpis?.tickets_resolvidos?.toString() || "0"}
          description={`${kpis?.percentual_resolucao || 0}% de resolução`}
          icon={<CheckCircleIcon className="h-4 w-4 text-success" />}
        />
        <KPICard
          title="SLA Vencido"
          value={kpis?.tickets_sla_vencido?.toString() || "0"}
          description="Tickets fora do prazo"
          icon={<AlertTriangleIcon className="h-4 w-4 text-critical" />}
        />
        <KPICard
          title="Tempo Médio"
          value={`${kpis?.tempo_medio_resolucao?.toFixed(1) || "0"}h`}
          description="Resolução média"
          icon={<ClockIcon className="h-4 w-4 text-warning" />}
        />
      </div>

      {/* Additional KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Tickets em Aberto"
          value={kpis?.tickets_abertos?.toString() || "0"}
          description="Aguardando atendimento"
          icon={<TrendingUpIcon className="h-4 w-4 text-warning" />}
        />
        <KPICard
          title="Tickets de Crise"
          value={kpis?.tickets_crise?.toString() || "0"}
          description="Prioridade máxima"
          icon={<AlertTriangleIcon className="h-4 w-4 text-critical" />}
        />
        <KPICard
          title="Equipes Ativas"
          value={kpis?.equipes_ativas?.toString() || "0"}
          description="Equipes em operação"
          icon={<UsersIcon className="h-4 w-4 text-info" />}
        />
        <KPICard
          title="IA Bem-Sucedida"
          value={`${kpis?.percentual_ia_sucesso || 0}%`}
          description="Taxa de sucesso da IA"
          icon={<CheckCircleIcon className="h-4 w-4 text-success" />}
        />
      </div>

      {/* Alerts Panel */}
      <AlertsPanel />
      
      {/* Ticket Detail Modal */}
      <Dialog open={!!selectedTicketId} onOpenChange={() => setSelectedTicketId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Ticket</DialogTitle>
          </DialogHeader>
          {selectedTicketId && (
            <TicketDetail 
              ticketId={selectedTicketId}
              onClose={() => setSelectedTicketId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
