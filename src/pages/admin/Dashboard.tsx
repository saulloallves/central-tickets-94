
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/dashboard/KPICard";
import { AlertsPanel } from "@/components/admin/AlertsPanel";
import { TicketDetail } from "@/components/tickets/TicketDetail";
import { useTeamDashboardMetrics } from "@/hooks/useTeamDashboardMetrics";
import { useRole } from "@/hooks/useRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  TicketIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  AlertTriangleIcon,
  TrendingUpIcon,
  UsersIcon,
  RefreshCw,
  User,
  Users,
  BarChart3,
  AlertCircle
} from "lucide-react";

const Dashboard = () => {
  const { isAdmin, isColaborador } = useRole();
  const { 
    personalMetrics, 
    teamMetrics, 
    crisisMetrics, 
    loading, 
    primaryEquipe,
    refetch 
  } = useTeamDashboardMetrics();
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard da Equipe</h1>
            <p className="text-muted-foreground">
              Visão focada na sua produtividade e equipe
            </p>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 md:space-y-6 pt-3 md:pt-6">
      {/* Header com Alerta de Crise */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-3xl font-bold tracking-tight">Dashboard da Equipe</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {primaryEquipe ? `Equipe: ${primaryEquipe.equipes.nome}` : 'Visão focada na sua produtividade'}
            </p>
          </div>
          <Button variant="outline" onClick={refetch} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Alerta de Crise - só aparece quando há crise ativa */}
        {crisisMetrics?.crise_ativa && (
          <Card className="border-destructive bg-destructive/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">🚨 ALERTA DE CRISE ATIVA 🚨</CardTitle>
              </div>
              <CardDescription className="text-destructive/80">
                Uma situação de crise está em andamento. Priorize o atendimento aos tickets críticos.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>

      {/* SEÇÃO 1: MINHA PRODUTIVIDADE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            SEÇÃO 1: MINHA PRODUTIVIDADE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-5">
            <KPICard
              title="Meus Tickets Abertos"
              value={personalMetrics?.meus_tickets_abertos?.toString() || "0"}
              description="Tickets em minha fila"
              icon={<TicketIcon className="h-4 w-4 text-warning" />}
            />
            <KPICard
              title="Em Atendimento"
              value={personalMetrics?.meus_tickets_em_atendimento?.toString() || "0"}
              description="Que estou resolvendo"
              icon={<User className="h-4 w-4 text-info" />}
            />
            <KPICard
              title="Crítico"
              value={personalMetrics?.meus_tickets_por_prioridade?.critico?.toString() || "0"}
              description="Prioridade máxima"
              icon={<AlertTriangleIcon className="h-4 w-4 text-critical" />}
            />
            <KPICard
              title="Alto"
              value={personalMetrics?.meus_tickets_por_prioridade?.alto?.toString() || "0"}
              description="Até 1 hora"
              icon={<ClockIcon className="h-4 w-4 text-warning" />}
            />
            <KPICard
              title="Médio"
              value={personalMetrics?.meus_tickets_por_prioridade?.medio?.toString() || "0"}
              description="Hoje/Pode esperar"
              icon={<BarChart3 className="h-4 w-4 text-success" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: VISÃO DA EQUIPE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            SEÇÃO 2: VISÃO DA EQUIPE {primaryEquipe ? `DE ${primaryEquipe.equipes.nome.toUpperCase()}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Métricas principais da equipe */}
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
            <KPICard
              title="Fila da Equipe"
              value={teamMetrics?.fila_equipe?.toString() || "0"}
              description="Tickets aguardando"
              icon={<TicketIcon className="h-4 w-4 text-warning" />}
            />
            <KPICard
              title="Resolvidos Hoje"
              value={teamMetrics?.resolvidos_hoje?.toString() || "0"}
              description="Tickets finalizados"
              icon={<CheckCircleIcon className="h-4 w-4 text-success" />}
            />
            <KPICard
              title="Total Abertos"
              value={teamMetrics?.total_abertos?.toString() || "0"}
              description="Em todas as etapas"
              icon={<TrendingUpIcon className="h-4 w-4 text-info" />}
            />
          </div>

          {/* Carga por Colaborador e Tickets próximos de vencer */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Carga por Colaborador */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Carga por Colaborador</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teamMetrics?.carga_por_colaborador?.length ? (
                  teamMetrics.carga_por_colaborador.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="truncate">{item.nome}:</span>
                      <Badge variant="secondary">{item.tickets} tickets</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum colaborador com tickets ativos</p>
                )}
              </CardContent>
            </Card>

            {/* Tickets Próximos de Violar SLA */}
            <Card className="bg-warning/10 border-warning/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-warning" />
                  Tickets Próximos de Violar SLA (Meus)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teamMetrics?.tickets_proximos_vencer?.length ? (
                  teamMetrics.tickets_proximos_vencer.slice(0, 3).map((ticket, index) => (
                    <div key={index} className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">[ID] [Título]</span>
                        <span className="text-muted-foreground">[Tempo Restante]</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum ticket próximo do vencimento</p>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 3: STATUS GERAL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            SEÇÃO 3: STATUS GERAL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
            <KPICard
              title="Tickets Críticos (Equipe)"
              value={crisisMetrics?.tickets_criticos_equipe?.toString() || "0"}
              description="Crise + Imediato"
              icon={<AlertTriangleIcon className="h-4 w-4 text-critical" />}
            />
            <KPICard
              title="Backlog (Últimos 7 dias)"
              value={crisisMetrics?.backlog_ultimos_7_dias?.toString() || "0"}
              description="Tickets em aberto"
              icon={<TrendingUpIcon className="h-4 w-4 text-info" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alerts Panel */}
      <AlertsPanel />
      
      {/* Ticket Detail Modal */}
      <Dialog open={!!selectedTicketId} onOpenChange={() => setSelectedTicketId(null)}>
        <DialogContent className="w-[96vw] max-w-6xl h-[90vh] p-0 overflow-hidden">
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
