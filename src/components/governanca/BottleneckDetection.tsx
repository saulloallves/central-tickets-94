
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Clock, Users, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface BottleneckData {
  slowTickets: any[];
  overloadedTeams: any[];
  overloadedUsers: any[];
  avgResponseTimes: any[];
  alerts: any[];
}

export const BottleneckDetection = () => {
  const [data, setData] = useState<BottleneckData>({
    slowTickets: [],
    overloadedTeams: [],
    overloadedUsers: [],
    avgResponseTimes: [],
    alerts: []
  });
  const [loading, setLoading] = useState(true);

  const fetchBottleneckData = async () => {
    try {
      // Tickets com tempo de espera acima da média
      const { data: slowTickets } = await supabase
        .from('tickets')
        .select(`
          id, codigo_ticket, descricao_problema, prioridade, status,
          data_abertura, equipe_responsavel_id, unidade_id
        `)
        .in('status', ['aberto', 'em_atendimento', 'escalonado'])
        .order('data_abertura', { ascending: true })
        .limit(20);

      // Contagem de tickets por equipe
      const { data: teamCounts } = await supabase
        .from('tickets')
        .select('equipe_responsavel_id, status')
        .in('status', ['aberto', 'em_atendimento', 'escalonado']);

      // Processar dados das equipes
      const teamStats = teamCounts?.reduce((acc: any, ticket) => {
        const teamId = ticket.equipe_responsavel_id || 'unassigned';
        if (!acc[teamId]) {
          acc[teamId] = { total: 0, abertos: 0, em_atendimento: 0, escalonado: 0 };
        }
        acc[teamId].total++;
        acc[teamId][ticket.status]++;
        return acc;
      }, {});

      const overloadedTeams = Object.entries(teamStats || {})
        .map(([teamId, stats]: [string, any]) => ({
          teamId,
          ...stats,
          overloadScore: stats.total * 1.5 + stats.abertos * 2
        }))
        .filter(team => team.total > 10)
        .sort((a, b) => b.overloadScore - a.overloadScore)
        .slice(0, 10);

      // Calcular tempos médios de resposta (simulado)
      const avgResponseTimes = [
        { entity: 'Equipe Técnica', avgTime: 2.5, trend: 'up', tickets: 45 },
        { entity: 'Suporte Geral', avgTime: 1.8, trend: 'down', tickets: 32 },
        { entity: 'Atendimento VIP', avgTime: 0.8, trend: 'stable', tickets: 12 },
        { entity: 'Emergência', avgTime: 4.2, trend: 'up', tickets: 8 }
      ];

      // Gerar alertas baseados nos dados
      const alerts = [];
      
      if (slowTickets && slowTickets.length > 15) {
        alerts.push({
          type: 'warning',
          message: `${slowTickets.length} tickets com tempo de espera elevado`,
          severity: 'medium'
        });
      }

      overloadedTeams.forEach(team => {
        if (team.total > 20) {
          alerts.push({
            type: 'error',
            message: `Equipe ${team.teamId} com ${team.total} tickets acumulados`,
            severity: 'high'
          });
        }
      });

      setData({
        slowTickets: slowTickets || [],
        overloadedTeams,
        overloadedUsers: [], // Placeholder
        avgResponseTimes,
        alerts
      });
    } catch (error) {
      console.error('Error fetching bottleneck data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBottleneckData();
    
    // Atualizar a cada 2 minutos
    const interval = setInterval(fetchBottleneckData, 2 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const calculateWaitTime = (dataAbertura: string) => {
    const now = new Date();
    const opened = new Date(dataAbertura);
    const diffHours = Math.floor((now.getTime() - opened.getTime()) / (1000 * 60 * 60));
    return diffHours;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando análise de gargalos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alertas Críticos */}
      {data.alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-5 w-5" />
              Alertas de Gargalos Detectados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.alerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span>{alert.message}</span>
                  </div>
                  <Badge variant={getAlertColor(alert.severity)}>
                    {alert.severity === 'high' ? 'Alta' : alert.severity === 'medium' ? 'Média' : 'Baixa'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tickets com Tempo Elevado */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Tickets com Tempo de Espera Elevado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-3">
                {data.slowTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum ticket com atraso significativo</p>
                  </div>
                ) : (
                  data.slowTickets.map((ticket) => {
                    const waitTime = calculateWaitTime(ticket.data_abertura);
                    return (
                      <div key={ticket.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {ticket.codigo_ticket}
                            </Badge>
                            <Badge variant={ticket.prioridade === 'crise' ? 'destructive' : 'secondary'} className="text-xs">
                              {ticket.prioridade}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {ticket.descricao_problema}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {ticket.unidade_id}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${waitTime > 24 ? 'text-red-600' : waitTime > 8 ? 'text-orange-600' : 'text-yellow-600'}`}>
                            {waitTime}h
                          </div>
                          <span className="text-xs text-muted-foreground">
                            em espera
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Equipes Sobrecarregadas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-red-500" />
              Equipes com Alto Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-3">
                {data.overloadedTeams.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Carga das equipes equilibrada</p>
                  </div>
                ) : (
                  data.overloadedTeams.map((team, index) => (
                    <div key={team.teamId} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={team.total > 25 ? 'destructive' : 'secondary'}>
                            {team.teamId === 'unassigned' ? 'Não Atribuída' : `Equipe ${team.teamId}`}
                          </Badge>
                          <span className="text-sm font-medium">{team.total} tickets</span>
                        </div>
                        <div className={`text-sm ${team.total > 25 ? 'text-red-600' : 'text-orange-600'}`}>
                          Score: {Math.round(team.overloadScore)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center p-2 bg-red-50 rounded">
                          <div className="font-medium text-red-700">{team.abertos}</div>
                          <div className="text-red-600">Abertos</div>
                        </div>
                        <div className="text-center p-2 bg-yellow-50 rounded">
                          <div className="font-medium text-yellow-700">{team.em_atendimento}</div>
                          <div className="text-yellow-600">Em Atend.</div>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="font-medium text-blue-700">{team.escalonado}</div>
                          <div className="text-blue-600">Escalonado</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Tempos Médios de Resposta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tempo Médio de Resposta por Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {data.avgResponseTimes.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{item.entity}</h4>
                  {getTrendIcon(item.trend)}
                </div>
                
                <div className="text-2xl font-bold mb-1">
                  {item.avgTime}h
                </div>
                
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{item.tickets} tickets</span>
                  <span className={
                    item.trend === 'up' ? 'text-red-600' : 
                    item.trend === 'down' ? 'text-green-600' : 
                    'text-yellow-600'
                  }>
                    {item.trend === 'up' ? '↗️ Subindo' : 
                     item.trend === 'down' ? '↘️ Melhorando' : 
                     '➡️ Estável'}
                  </span>
                </div>
                
                <Progress 
                  value={Math.min((item.avgTime / 5) * 100, 100)} 
                  className="mt-3"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
