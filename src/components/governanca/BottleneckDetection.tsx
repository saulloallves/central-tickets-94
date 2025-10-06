import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertTriangle, 
  Clock, 
  Users, 
  TrendingDown, 
  RefreshCw,
  UserX,
  Timer,
  BarChart3,
  Target
} from "lucide-react";
import { useSystemLogs } from "@/hooks/useSystemLogs";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

export function BottleneckDetection() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { logSystemAction } = useSystemLogs();
  const [threshold, setThreshold] = useState<number>(24); // horas
  const [teamThreshold, setTeamThreshold] = useState<number>(10); // número de tickets

  const fetchTicketsDirectly = async () => {
    setLoading(true);
    try {
      console.log('🎯 [BOTTLENECK] Fetching tickets for bottleneck analysis...');
      
      // Try multiple approaches to get ticket data
      let ticketsData: any[] = [];
      
      // Approach 1: Use the RPC function that's working for team metrics
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_realtime_kpis', {
          p_periodo_dias: 30
        });
        
        if (!rpcError && rpcData) {
          console.log('✅ [BOTTLENECK] RPC call successful:', rpcData);
          
          // Now get detailed ticket data
          const { data: detailData, error: detailError } = await supabase
            .from('tickets')
            .select(`
              id,
              codigo_ticket,
              data_abertura,
              status,
              prioridade,
              equipe_responsavel_id,
              colaborador_id,
              resolvido_em,
              categoria,
              unidade_id
            `)
            .gte('data_abertura', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
            
          if (!detailError && detailData) {
            ticketsData = detailData;
            console.log('✅ [BOTTLENECK] Detailed tickets fetched:', ticketsData.length);
          }
        }
      } catch (rpcError) {
        console.log('⚠️ [BOTTLENECK] RPC approach failed, trying direct query');
      }
      
      // Approach 2: If RPC failed, try direct query with minimal fields
      if (ticketsData.length === 0) {
        try {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: directData, error: directError } = await supabase
            .from('tickets')
            .select('id, codigo_ticket, data_abertura, status, prioridade, equipe_responsavel_id, colaborador_id, resolvido_em, categoria')
            .gte('data_abertura', thirtyDaysAgo)
            .order('data_abertura', { ascending: false })
            .limit(1000);
          
          if (!directError && directData) {
            ticketsData = directData;
            console.log('✅ [BOTTLENECK] Direct query successful:', ticketsData.length);
          } else {
            console.error('❌ [BOTTLENECK] Direct query failed:', directError);
          }
        } catch (directError) {
          console.error('💥 [BOTTLENECK] Direct query exception:', directError);
        }
      }

      console.log('✅ [BOTTLENECK] Final tickets data:', ticketsData.length);
      setTickets(ticketsData);
      
    } catch (error) {
      console.error('💥 [BOTTLENECK] Critical error:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketsDirectly();
  }, []);

  // Calcular métricas de gargalos
  const bottleneckMetrics = useMemo(() => {
    if (!tickets) return { slowTickets: [], overloadedTeams: [], overloadedAgents: [], responseTimesByTeam: [], responseTimesByPriority: [] };

    const now = new Date();
    
    // Tickets com tempo acima da média
    const openTickets = tickets.filter(t => ['aberto', 'em_atendimento', 'escalonado'].includes(t.status));
    const waitTimes = openTickets.map(t => ({
      ...t,
      waitHours: (now.getTime() - new Date(t.data_abertura).getTime()) / (1000 * 60 * 60)
    }));
    
    const avgWaitTime = waitTimes.reduce((sum, t) => sum + t.waitHours, 0) / waitTimes.length || 0;
    const slowTickets = waitTimes.filter(t => t.waitHours > Math.max(avgWaitTime, threshold));

    // Equipes sobrecarregadas
    const teamTicketCounts = tickets.reduce((acc, ticket) => {
      if (ticket.status === 'concluido' || !ticket.equipe_responsavel_id) return acc;
      
      const teamId = ticket.equipe_responsavel_id;
      if (!acc[teamId]) {
        acc[teamId] = { teamId, count: 0, tickets: [] };
      }
      acc[teamId].count++;
      acc[teamId].tickets.push(ticket);
      return acc;
    }, {} as Record<string, any>);

    const overloadedTeams = Object.values(teamTicketCounts)
      .filter((team: any) => team.count > teamThreshold)
      .sort((a: any, b: any) => b.count - a.count);

    // Atendentes sobrecarregados
    const agentTicketCounts = tickets.reduce((acc, ticket) => {
      if (ticket.status === 'concluido' || !ticket.colaborador_id) return acc;
      
      const agentId = ticket.colaborador_id;
      if (!acc[agentId]) {
        acc[agentId] = { agentId, count: 0, tickets: [] };
      }
      acc[agentId].count++;
      acc[agentId].tickets.push(ticket);
      return acc;
    }, {} as Record<string, any>);

    const overloadedAgents = Object.values(agentTicketCounts)
      .filter((agent: any) => agent.count > 5) // Limite de 5 tickets por atendente
      .sort((a: any, b: any) => b.count - a.count);

    // Tempo médio de resposta por equipe
    const resolvedTickets = tickets.filter(t => t.resolvido_em && t.equipe_responsavel_id);
    const teamResponseTimes = resolvedTickets.reduce((acc, ticket) => {
      const teamId = ticket.equipe_responsavel_id!;
      const responseTime = (new Date(ticket.resolvido_em!).getTime() - new Date(ticket.data_abertura).getTime()) / (1000 * 60 * 60);
      
      if (!acc[teamId]) {
        acc[teamId] = { teamId, times: [], avg: 0 };
      }
      acc[teamId].times.push(responseTime);
      return acc;
    }, {} as Record<string, any>);

    const responseTimesByTeam = Object.values(teamResponseTimes).map((team: any) => ({
      ...team,
      avg: team.times.reduce((sum: number, time: number) => sum + time, 0) / team.times.length
    }));

    // Tempo médio por prioridade
    const priorityResponseTimes = resolvedTickets.reduce((acc, ticket) => {
      const priority = ticket.prioridade;
      const responseTime = (new Date(ticket.resolvido_em!).getTime() - new Date(ticket.data_abertura).getTime()) / (1000 * 60 * 60);
      
      if (!acc[priority]) {
        acc[priority] = { priority, times: [], avg: 0 };
      }
      acc[priority].times.push(responseTime);
      return acc;
    }, {} as Record<string, any>);

    const responseTimesByPriority = Object.values(priorityResponseTimes).map((priority: any) => ({
      ...priority,
      avg: priority.times.reduce((sum: number, time: number) => sum + time, 0) / priority.times.length
    }));

    return {
      slowTickets,
      overloadedTeams,
      overloadedAgents,
      responseTimesByTeam,
      responseTimesByPriority,
      avgWaitTime
    };
  }, [tickets, threshold, teamThreshold]);

  const createAlert = async (type: string, level: string, category: string, payload: any) => {
    try {
      await logSystemAction({
        tipo_log: 'sistema' as any,
        entidade_afetada: 'gargalos',
        entidade_id: type,
        acao_realizada: `Alerta de gargalo: ${type}`,
        dados_novos: { type, level, category, ...payload }
      });
    } catch (error) {
      console.error('Erro ao criar alerta:', error);
    }
  };

  const handleCreateAlerts = () => {
    // Alertas para equipes sobrecarregadas
    bottleneckMetrics.overloadedTeams.forEach((team: any) => {
      if (team.count > teamThreshold * 1.5) {
        createAlert('team_overload', 'critical', 'equipe', {
          teamId: team.teamId,
          ticketCount: team.count,
          threshold: teamThreshold
        });
      }
    });

    // Alertas para atendentes sobrecarregados
    bottleneckMetrics.overloadedAgents.forEach((agent: any) => {
      createAlert('agent_overload', 'warning', 'colaborador', {
        agentId: agent.agentId,
        ticketCount: agent.count
      });
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'crise': return 'destructive';
      case 'imediato': return 'destructive';
      case 'alto': return 'destructive';
      case 'medio': return 'warning';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Detecção de Gargalos</h2>
          <p className="text-muted-foreground">Identificação de problemas operacionais</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleCreateAlerts}
            className="liquid-glass-button"
            disabled={loading}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Criar Alertas
          </Button>
          <Button
            onClick={fetchTicketsDirectly}
            disabled={loading}
            className="liquid-glass-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Configuration */}
      <Card className="liquid-glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Configurações de Limite</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Limite de Tempo (horas)</label>
              <Select value={threshold.toString()} onValueChange={(value) => setThreshold(Number(value))}>
                <SelectTrigger className="liquid-glass-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="48">48 horas</SelectItem>
                  <SelectItem value="72">72 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Limite de Tickets por Equipe</label>
              <Select value={teamThreshold.toString()} onValueChange={(value) => setTeamThreshold(Number(value))}>
                <SelectTrigger className="liquid-glass-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 tickets</SelectItem>
                  <SelectItem value="10">10 tickets</SelectItem>
                  <SelectItem value="15">15 tickets</SelectItem>
                  <SelectItem value="20">20 tickets</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tickets Lentos</p>
                <p className="text-2xl font-bold text-critical">{bottleneckMetrics.slowTickets.length}</p>
              </div>
              <Clock className="h-8 w-8 text-critical" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Acima de {threshold}h
            </p>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Equipes Sobrecarregadas</p>
                <p className="text-2xl font-bold text-warning">{bottleneckMetrics.overloadedTeams.length}</p>
              </div>
              <Users className="h-8 w-8 text-warning" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Acima de {teamThreshold} tickets
            </p>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Atendentes Sobrecarregados</p>
                <p className="text-2xl font-bold text-info">{bottleneckMetrics.overloadedAgents.length}</p>
              </div>
              <UserX className="h-8 w-8 text-info" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Acima de 5 tickets
            </p>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tempo Médio Espera</p>
                <p className="text-2xl font-bold text-foreground">{bottleneckMetrics.avgWaitTime.toFixed(1)}h</p>
              </div>
              <Timer className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Tickets em aberto
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Slow Tickets */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-critical" />
              <span>Tickets com Espera Excessiva</span>
            </CardTitle>
            <CardDescription>
              Tickets aguardando há mais de {threshold} horas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
            ) : bottleneckMetrics.slowTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-sm font-medium text-foreground mb-2">✅ Nenhum ticket com espera excessiva</p>
                <p className="text-xs text-muted-foreground">
                  Todos os tickets estão dentro do tempo esperado de {threshold}h
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bottleneckMetrics.slowTickets.slice(0, 10).map((ticket: any) => (
                  <div key={ticket.id} className="flex items-center justify-between p-3 bg-critical/10 border border-critical/20 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{ticket.codigo_ticket}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant={getPriorityColor(ticket.prioridade)}>
                          {ticket.prioridade}
                        </Badge>
                        <Badge variant="outline">
                          {ticket.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-critical">
                        {ticket.waitHours.toFixed(1)}h
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ticket.data_abertura), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
                {bottleneckMetrics.slowTickets.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{bottleneckMetrics.slowTickets.length - 10} tickets adicionais
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overloaded Teams */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-warning" />
              <span>Equipes Sobrecarregadas</span>
            </CardTitle>
            <CardDescription>
              Equipes com mais de {teamThreshold} tickets ativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Carregando dados...</p>
              </div>
            ) : bottleneckMetrics.overloadedTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-sm font-medium text-foreground mb-2">✅ Nenhuma equipe sobrecarregada</p>
                <p className="text-xs text-muted-foreground">
                  Todas as equipes estão com carga abaixo de {teamThreshold} tickets ativos
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bottleneckMetrics.overloadedTeams.map((team: any) => (
                  <div key={team.teamId} className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Equipe {team.teamId}</p>
                      <Badge variant="destructive">
                        {team.count} tickets
                      </Badge>
                    </div>
                    <Progress 
                      value={Math.min((team.count / teamThreshold) * 100, 100)} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {((team.count / teamThreshold - 1) * 100).toFixed(0)}% acima do limite
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response Times by Team */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Tempo Médio por Equipe</span>
            </CardTitle>
            <CardDescription>
              Performance de resolução por equipe
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bottleneckMetrics.responseTimesByTeam.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Sem dados de tempo de resposta
              </p>
            ) : (
              <div className="space-y-3">
                {bottleneckMetrics.responseTimesByTeam
                  .sort((a: any, b: any) => b.avg - a.avg)
                  .slice(0, 8)
                  .map((team: any) => (
                    <div key={team.teamId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Equipe {team.teamId}</p>
                        <p className="text-xs text-muted-foreground">
                          {team.times.length} ticket(s) resolvido(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {team.avg.toFixed(1)}h
                        </p>
                        <Badge variant={team.avg > 24 ? "destructive" : team.avg > 12 ? "warning" : "default"}>
                          {team.avg > 24 ? "Lento" : team.avg > 12 ? "Médio" : "Rápido"}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response Times by Priority */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingDown className="h-5 w-5" />
              <span>Tempo Médio por Prioridade</span>
            </CardTitle>
            <CardDescription>
              Performance por nível de urgência
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bottleneckMetrics.responseTimesByPriority.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Sem dados de tempo de resposta
              </p>
            ) : (
              <div className="space-y-3">
                {bottleneckMetrics.responseTimesByPriority.map((priority: any) => (
                  <div key={priority.priority} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <Badge variant={getPriorityColor(priority.priority)}>
                        {priority.priority}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {priority.times.length} ticket(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        {priority.avg.toFixed(1)}h
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}