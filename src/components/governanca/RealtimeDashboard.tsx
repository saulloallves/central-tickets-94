import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Activity, 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  RefreshCw,
  Eye,
  UserCheck,
  Zap,
  Calendar,
  User,
  Building,
  Tag,
  FileText,
  MapPin
} from "lucide-react";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useTicketsRealtime } from "@/hooks/useTicketsRealtime";
import { useTickets } from "@/hooks/useTickets";
import { usePresence } from "@/hooks/usePresence";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MetricsDisplay } from "./MetricsDisplay";
import { EmptyState } from "./EmptyState";

export function RealtimeDashboard() {
  const { kpis, loading: kpisLoading, fetchKPIs } = useDashboardMetrics();
  const { tickets, loading: ticketsLoading, refetch } = useTickets({
    search: '',
    status: '',
    categoria: '',
    prioridade: '',
    unidade_id: '',
    status_sla: '',
    equipe_id: ''
  });
  const { onlineUsers, totalOnline } = usePresence();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to open ticket modal
  const openTicketModal = (ticket: any) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  // Function to close ticket modal
  const closeTicketModal = () => {
    setSelectedTicket(null);
    setIsModalOpen(false);
  };

  // Real-time updates
  useTicketsRealtime({
    onTicketUpdate: () => {
      refetch();
      setLastUpdate(new Date());
    },
    onTicketInsert: () => {
      refetch();
      setLastUpdate(new Date());
    },
    onTicketDelete: () => {
      refetch();
      setLastUpdate(new Date());
    },
  });

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  const refreshData = () => {
    fetchKPIs();
    refetch();
    setLastUpdate(new Date());
  };

  // Calculate real-time metrics
  const getStatusCounts = () => {
    if (!tickets) return { abertos: 0, emAtendimento: 0, pendentes: 0, concluidos: 0 };
    
    const counts = tickets.reduce((acc, ticket) => {
      switch (ticket.status) {
        case 'aberto':
          acc.abertos++;
          break;
        case 'em_atendimento':
          acc.emAtendimento++;
          break;
        case 'escalonado':
          acc.pendentes++;
          break;
        case 'concluido':
          acc.concluidos++;
          break;
      }
      return acc;
    }, { abertos: 0, emAtendimento: 0, pendentes: 0, concluidos: 0 });

    return counts;
  };

  const getRecentTickets = () => {
    if (!tickets) return [];
    return tickets
      .sort((a, b) => new Date(b.data_abertura).getTime() - new Date(a.data_abertura).getTime())
      .slice(0, 10);
  };

  const getSLAAlerts = () => {
    if (!tickets) return [];
    return tickets.filter(ticket => 
      ticket.status_sla === 'alerta' && 
      ['aberto', 'em_atendimento', 'escalonado'].includes(ticket.status)
    );
  };

  const getTicketsByTeam = () => {
    if (!tickets) return [];
    const teamCounts = tickets.reduce((acc, ticket) => {
      if (!ticket.equipe_responsavel_id || ticket.status === 'concluido') return acc;
      
      const teamId = ticket.equipe_responsavel_id;
      if (!acc[teamId]) {
        acc[teamId] = {
          id: teamId,
          name: ticket.equipes?.nome || 'Sem Equipe',
          count: 0,
          tickets: []
        };
      }
      acc[teamId].count++;
      acc[teamId].tickets.push(ticket);
      return acc;
    }, {} as Record<string, any>);

    return Object.values(teamCounts);
  };

  const statusCounts = getStatusCounts();
  const recentTickets = getRecentTickets();
  const slaAlerts = getSLAAlerts();
  const teamQueues = getTicketsByTeam();

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Painel em Tempo Real</h2>
          <p className="text-muted-foreground">
            Última atualização: {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: ptBR })}
          </p>
        </div>
        <Button
          onClick={refreshData}
          disabled={kpisLoading || ticketsLoading}
          className="liquid-glass-button"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${(kpisLoading || ticketsLoading) ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Tickets</p>
                <p className="text-2xl font-bold text-foreground">{kpis?.total_tickets || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-primary" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1" />
              Últimos 30 dias
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">SLA Performance</p>
                <p className="text-2xl font-bold text-foreground">{kpis?.percentual_sla || 0}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <div className="mt-2">
              <Badge variant={kpis?.percentual_sla >= 90 ? "default" : "destructive"} className="text-xs">
                {kpis?.tickets_sla_ok || 0} de {kpis?.total_tickets || 0} no prazo
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold text-foreground">{kpis?.tempo_medio_resolucao || 0}h</p>
              </div>
              <Clock className="h-8 w-8 text-info" />
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <Zap className="h-3 w-3 mr-1" />
              Resolução média
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usuários Online</p>
                <p className="text-2xl font-bold text-foreground">{totalOnline}</p>
              </div>
              <Users className="h-8 w-8 text-warning" />
            </div>
            <div className="mt-2 flex items-center text-xs text-success">
              <div className="w-2 h-2 bg-success rounded-full mr-1"></div>
              Conectados agora
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="liquid-glass-card">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-info">{statusCounts.abertos}</p>
              <p className="text-sm text-muted-foreground">Abertos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-warning">{statusCounts.emAtendimento}</p>
              <p className="text-sm text-muted-foreground">Em Atendimento</p>
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-critical">{statusCounts.pendentes}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-success">{statusCounts.concluidos}</p>
              <p className="text-sm text-muted-foreground">Concluídos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tickets */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Últimos Tickets</span>
            </CardTitle>
            <CardDescription>Tickets criados recentemente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTickets.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum ticket encontrado</p>
            ) : (
              recentTickets.map((ticket) => {
                // Debug: log ticket structure to understand what fields are available
                console.log('🎫 [RECENT TICKET DEBUG]', {
                  id: ticket.id,
                  titulo: ticket.titulo,
                  codigo_ticket: ticket.codigo_ticket,
                  categoria: ticket.categoria,
                  descricao_problema: ticket.descricao_problema,
                  allFields: Object.keys(ticket)
                });
                
                // Check if codigo_ticket is a UUID and create friendly display
                const isUuidCode = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket.codigo_ticket || '');
                
                // Prioritize showing ticket title - try different title fields
                let displayCode;
                let displayTitle;
                
                // Try multiple possible title fields
                const ticketTitle = ticket.titulo || ticket.descricao_problema;
                
                if (ticketTitle && ticketTitle.trim() !== '') {
                  // If we have a title, show it prominently
                  displayTitle = ticketTitle.length > 50 ? ticketTitle.substring(0, 50) + '...' : ticketTitle;
                  if (isUuidCode || !ticket.codigo_ticket) {
                    const shortId = ticket.id.split('-')[0].toUpperCase();
                    displayCode = `#${shortId}`;
                  } else {
                    displayCode = ticket.codigo_ticket;
                  }
                } else {
                  // Fallback when no title is available
                  if (isUuidCode || !ticket.codigo_ticket) {
                    const shortId = ticket.id.split('-')[0].toUpperCase();
                    displayTitle = `Ticket #${shortId}`;
                    displayCode = ticket.categoria || 'Sem categoria';
                  } else {
                    displayTitle = ticket.codigo_ticket;
                    displayCode = ticket.categoria || 'Ticket';
                  }
                }
                
                return (
                  <div 
                    key={ticket.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 cursor-pointer transition-colors"
                    onClick={() => openTicketModal(ticket)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayTitle}</p>
                      <p className="text-xs text-muted-foreground truncate">{displayCode}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {ticket.canal_origem}
                        </Badge>
                        <Badge 
                          variant={
                            ticket.prioridade === 'crise' ? 'destructive' :
                            ticket.prioridade === 'imediato' ? 'destructive' :
                            ticket.prioridade === 'ate_1_hora' ? 'destructive' :
                            'secondary'
                          }
                          className="text-xs"
                        >
                          {ticket.prioridade}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(ticket.data_abertura), { addSuffix: true, locale: ptBR })}
                    </div>
                  </div>
                 );
               })
             )}
          </CardContent>
        </Card>

        {/* SLA Alerts */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <span>Alertas de SLA</span>
            </CardTitle>
            <CardDescription>Tickets próximos do vencimento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {slaAlerts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">✅ Nenhum alerta de SLA</p>
            ) : (
              slaAlerts.map((ticket) => {
                // Check if codigo_ticket is a UUID and create friendly display for SLA alerts too
                const isUuidCode = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket.codigo_ticket || '');
                
                // Prioritize showing ticket title for SLA alerts too
                let displayCode;
                let displayTitle;
                
                if (ticket.titulo) {
                  displayTitle = ticket.titulo;
                  if (isUuidCode || !ticket.codigo_ticket) {
                    const shortId = ticket.id.split('-')[0].toUpperCase();
                    displayCode = `#${shortId}`;
                  } else {
                    displayCode = ticket.codigo_ticket;
                  }
                } else {
                  if (isUuidCode || !ticket.codigo_ticket) {
                    const shortId = ticket.id.split('-')[0].toUpperCase();
                    displayTitle = `Ticket #${shortId}`;
                    displayCode = ticket.categoria || 'SLA Alert';
                  } else {
                    displayTitle = ticket.codigo_ticket;
                    displayCode = ticket.categoria || 'SLA Alert';
                  }
                }
                
                return (
                  <div key={ticket.id} className="flex items-center justify-between p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayTitle}</p>
                      <p className="text-xs text-muted-foreground truncate">{displayCode}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {ticket.data_limite_sla ? 
                          formatDistanceToNow(new Date(ticket.data_limite_sla), { addSuffix: true, locale: ptBR }) :
                          'N/A'
                        }
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {ticket.status_sla}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Team Queues */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5" />
              <span>Fila por Equipe</span>
            </CardTitle>
            <CardDescription>Tickets pendentes por equipe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamQueues.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhuma equipe com tickets pendentes</p>
            ) : (
              teamQueues.map((team) => (
                <div key={team.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{team.name}</p>
                  </div>
                  <Badge variant="secondary">
                    {team.count} tickets
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Online Users */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Usuários Online</span>
            </CardTitle>
            <CardDescription>Atividade em tempo real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {onlineUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum usuário online</p>
            ) : (
              onlineUsers.map((user) => (
                <div key={user.userId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.route}</p>
                    </div>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Ativo desde {formatDistanceToNow(new Date(user.timestamp), { addSuffix: true, locale: ptBR })}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ticket Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Detalhes do Ticket</span>
            </DialogTitle>
            <DialogDescription>
              Informações completas do ticket selecionado
            </DialogDescription>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Código do Ticket</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedTicket.codigo_ticket || `#${selectedTicket.id.split('-')[0].toUpperCase()}`}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Data de Abertura</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedTicket.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Canal de Origem</span>
                  </div>
                  <Badge variant="outline">{selectedTicket.canal_origem}</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Prioridade</span>
                  </div>
                  <Badge 
                    variant={
                      selectedTicket.prioridade === 'crise' ? 'destructive' :
                      selectedTicket.prioridade === 'imediato' ? 'destructive' :
                      selectedTicket.prioridade === 'ate_1_hora' ? 'destructive' :
                      'secondary'
                    }
                  >
                    {selectedTicket.prioridade}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Status</span>
                  </div>
                  <Badge 
                    variant={
                      selectedTicket.status === 'concluido' ? 'default' :
                      selectedTicket.status === 'em_atendimento' ? 'secondary' :
                      'outline'
                    }
                  >
                    {selectedTicket.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Status SLA</span>
                  </div>
                  <Badge 
                    variant={
                      selectedTicket.status_sla === 'dentro_prazo' ? 'default' :
                      selectedTicket.status_sla === 'alerta' ? 'secondary' :
                      'destructive'
                    }
                  >
                    {selectedTicket.status_sla}
                  </Badge>
                </div>
              </div>

              {/* Title and Description */}
              {(selectedTicket.titulo || selectedTicket.descricao_problema) && (
                <div className="space-y-4">
                  <div className="border-t pt-4">
                    <h4 className="text-lg font-semibold mb-2">Título/Descrição</h4>
                    {selectedTicket.titulo && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Título:</p>
                        <p className="text-sm">{selectedTicket.titulo}</p>
                      </div>
                    )}
                    {selectedTicket.descricao_problema && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Descrição do Problema:</p>
                        <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedTicket.descricao_problema}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-lg font-semibold">Informações Adicionais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {selectedTicket.categoria && (
                    <div>
                      <span className="font-medium text-muted-foreground">Categoria:</span>
                      <p>{selectedTicket.categoria}</p>
                    </div>
                  )}
                  {selectedTicket.equipes?.nome && (
                    <div>
                      <span className="font-medium text-muted-foreground">Equipe Responsável:</span>
                      <p>{selectedTicket.equipes.nome}</p>
                    </div>
                  )}
                  {selectedTicket.unidades?.nome && (
                    <div>
                      <span className="font-medium text-muted-foreground">Unidade:</span>
                      <p>{selectedTicket.unidades.nome}</p>
                    </div>
                  )}
                  {selectedTicket.data_limite_sla && (
                    <div>
                      <span className="font-medium text-muted-foreground">Prazo SLA:</span>
                      <p>{format(new Date(selectedTicket.data_limite_sla), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  )}
                  {selectedTicket.resolvido_em && (
                    <div>
                      <span className="font-medium text-muted-foreground">Resolvido em:</span>
                      <p>{format(new Date(selectedTicket.resolvido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={closeTicketModal} variant="outline">
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}