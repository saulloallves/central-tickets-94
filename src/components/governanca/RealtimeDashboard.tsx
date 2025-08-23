import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Clock, Users, Activity, Ticket } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketStats {
  abertos: number;
  em_atendimento: number;
  escalonado: number;
  concluidos: number;
  total: number;
}

interface RecentTicket {
  id: string;
  codigo_ticket: string;
  descricao_problema: string;
  prioridade: string;
  canal_origem: string;
  created_at: string;
  unidade_id: string;
  equipe_responsavel_id?: string;
}

interface SLAAlert {
  id: string;
  codigo_ticket: string;
  data_limite_sla: string;
  prioridade: string;
  minutes_remaining: number;
}

export const RealtimeDashboard = () => {
  const [ticketStats, setTicketStats] = useState<TicketStats>({
    abertos: 0,
    em_atendimento: 0,
    escalonado: 0,
    concluidos: 0,
    total: 0
  });
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [slaAlerts, setSlaAlerts] = useState<SLAAlert[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchTicketStats = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('status');

      if (error) throw error;

      const stats = data.reduce((acc, ticket) => {
        acc.total++;
        switch (ticket.status) {
          case 'aberto':
            acc.abertos++;
            break;
          case 'em_atendimento':
            acc.em_atendimento++;
            break;
          case 'escalonado':
            acc.escalonado++;
            break;
          case 'concluido':
            acc.concluidos++;
            break;
        }
        return acc;
      }, {
        abertos: 0,
        em_atendimento: 0,
        escalonado: 0,
        concluidos: 0,
        total: 0
      });

      setTicketStats(stats);
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
    }
  };

  const fetchRecentTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, codigo_ticket, descricao_problema, prioridade, canal_origem, data_abertura, unidade_id, equipe_responsavel_id')
        .order('data_abertura', { ascending: false })
        .limit(10);

      if (error) throw error;

      setRecentTickets(data.map(ticket => ({
        ...ticket,
        created_at: ticket.data_abertura
      })));
    } catch (error) {
      console.error('Error fetching recent tickets:', error);
    }
  };

  const fetchSLAAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, codigo_ticket, data_limite_sla, prioridade')
        .not('data_limite_sla', 'is', null)
        .in('status', ['aberto', 'em_atendimento', 'escalonado'])
        .order('data_limite_sla', { ascending: true })
        .limit(5);

      if (error) throw error;

      const alertsWithTime = data.map(ticket => {
        const limitTime = new Date(ticket.data_limite_sla);
        const now = new Date();
        const minutes_remaining = Math.floor((limitTime.getTime() - now.getTime()) / (1000 * 60));
        
        return {
          ...ticket,
          minutes_remaining
        };
      }).filter(ticket => ticket.minutes_remaining <= 120); // Próximos 2 horas

      setSlaAlerts(alertsWithTime);
    } catch (error) {
      console.error('Error fetching SLA alerts:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    const ticketsChannel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          fetchTicketStats();
          fetchRecentTickets();
          fetchSLAAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
    };
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchTicketStats(),
        fetchRecentTickets(),
        fetchSLAAlerts()
      ]);
      setLoading(false);
    };

    loadData();
    const cleanup = setupRealtimeSubscriptions();

    // Simular usuários online (em um sistema real, isso viria de presença real)
    setOnlineUsers(12);

    // Atualizar a cada 30 segundos
    const interval = setInterval(loadData, 30000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-red-500';
      case 'em_atendimento': return 'bg-yellow-500';
      case 'escalonado': return 'bg-blue-500';
      case 'concluido': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'crise': return 'destructive';
      case 'imediato': return 'destructive';
      case 'ate_1_hora': return 'secondary';
      case 'ainda_hoje': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="grid gap-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abertos</CardTitle>
            <Ticket className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketStats.abertos}</div>
            <div className="flex items-center">
              <div className="h-2 w-2 bg-red-500 rounded-full mr-2"></div>
              <span className="text-xs text-muted-foreground">Aguardando</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
            <Activity className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketStats.em_atendimento}</div>
            <div className="flex items-center">
              <div className="h-2 w-2 bg-yellow-500 rounded-full mr-2"></div>
              <span className="text-xs text-muted-foreground">Em progresso</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalonados</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketStats.escalonado}</div>
            <div className="flex items-center">
              <div className="h-2 w-2 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-xs text-muted-foreground">Escalonados</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
            <Ticket className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketStats.concluidos}</div>
            <div className="flex items-center">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-xs text-muted-foreground">Finalizados</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Online</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineUsers}</div>
            <div className="flex items-center">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Ativos agora</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Últimos Tickets Criados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-3">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {ticket.codigo_ticket}
                        </Badge>
                        <Badge variant={getPriorityColor(ticket.prioridade)} className="text-xs">
                          {ticket.prioridade}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {ticket.descricao_problema}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {ticket.canal_origem} • {ticket.unidade_id}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(ticket.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* SLA Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Alertas de SLA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-3">
                {slaAlerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum SLA próximo do vencimento</p>
                  </div>
                ) : (
                  slaAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg border-orange-200 bg-orange-50">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {alert.codigo_ticket}
                            </Badge>
                            <Badge variant={getPriorityColor(alert.prioridade)} className="text-xs">
                              {alert.prioridade}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-orange-700">
                          {alert.minutes_remaining > 0 ? 
                            `${alert.minutes_remaining} min restantes` : 
                            `Vencido há ${Math.abs(alert.minutes_remaining)} min`
                          }
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
