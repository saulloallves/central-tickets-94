import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, TrendingUp, Activity, Users, Clock, Calendar, FileText } from 'lucide-react';

interface UserActivity {
  date: string;
  ticketsCreated: number;
  ticketsResolved: number;
  logins: number;
}

interface TicketVolume {
  date: string;
  totalTickets: number;
}

interface AgentPerformance {
  agentId: string;
  ticketsResolved: number;
  avgResolutionTime: number;
}

interface KnowledgeBaseUsage {
  articleId: string;
  views: number;
  usefulnessRatings: number;
}

interface SystemLoad {
  time: string;
  cpuUsage: number;
  memoryUsage: number;
}

interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#a4de6c', '#d0ed57'];

export const UsageReports = () => {
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [ticketVolume, setTicketVolume] = useState<TicketVolume[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [knowledgeBaseUsage, setKnowledgeBaseUsage] = useState<KnowledgeBaseUsage[]>([]);
  const [systemLoad, setSystemLoad] = useState<SystemLoad[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Simulação de dados de atividade do usuário
        const userActivityData: UserActivity[] = [
          { date: '2024-01-01', ticketsCreated: 15, ticketsResolved: 10, logins: 25 },
          { date: '2024-01-02', ticketsCreated: 12, ticketsResolved: 15, logins: 22 },
          { date: '2024-01-03', ticketsCreated: 18, ticketsResolved: 13, logins: 28 },
          { date: '2024-01-04', ticketsCreated: 20, ticketsResolved: 18, logins: 30 },
          { date: '2024-01-05', ticketsCreated: 14, ticketsResolved: 20, logins: 24 },
        ];

        // Simulação de dados de volume de tickets
        const ticketVolumeData: TicketVolume[] = [
          { date: '2024-01-01', totalTickets: 120 },
          { date: '2024-01-02', totalTickets: 130 },
          { date: '2024-01-03', totalTickets: 145 },
          { date: '2024-01-04', totalTickets: 150 },
          { date: '2024-01-05', totalTickets: 135 },
        ];

        // Simulação de dados de desempenho do agente
        const agentPerformanceData: AgentPerformance[] = [
          { agentId: 'Agent001', ticketsResolved: 35, avgResolutionTime: 2.5 },
          { agentId: 'Agent002', ticketsResolved: 40, avgResolutionTime: 2.2 },
          { agentId: 'Agent003', ticketsResolved: 30, avgResolutionTime: 2.8 },
          { agentId: 'Agent004', ticketsResolved: 45, avgResolutionTime: 2.1 },
        ];

        // Simulação de dados de uso da base de conhecimento
        const knowledgeBaseUsageData: KnowledgeBaseUsage[] = [
          { articleId: 'KB001', views: 150, usefulnessRatings: 4.5 },
          { articleId: 'KB002', views: 130, usefulnessRatings: 4.2 },
          { articleId: 'KB003', views: 180, usefulnessRatings: 4.8 },
          { articleId: 'KB004', views: 200, usefulnessRatings: 4.9 },
        ];

        // Simulação de dados de carga do sistema
        const systemLoadData: SystemLoad[] = [
          { time: '08:00', cpuUsage: 60, memoryUsage: 70 },
          { time: '10:00', cpuUsage: 75, memoryUsage: 80 },
          { time: '12:00', cpuUsage: 80, memoryUsage: 85 },
          { time: '14:00', cpuUsage: 70, memoryUsage: 75 },
          { time: '16:00', cpuUsage: 65, memoryUsage: 72 },
        ];

        // Simulação de dados de logs de auditoria
        const auditLogsData: AuditLog[] = [
          { timestamp: '2024-01-05 08:00', user: 'User001', action: 'Login', details: 'Successful login' },
          { timestamp: '2024-01-05 09:30', user: 'User002', action: 'Ticket Created', details: 'Created ticket #123' },
          { timestamp: '2024-01-05 11:00', user: 'User001', action: 'Ticket Updated', details: 'Updated ticket #123' },
          { timestamp: '2024-01-05 13:45', user: 'User003', action: 'Knowledge Base Accessed', details: 'Accessed article KB001' },
        ];

        setUserActivity(userActivityData);
        setTicketVolume(ticketVolumeData);
        setAgentPerformance(agentPerformanceData);
        setKnowledgeBaseUsage(knowledgeBaseUsageData);
        setSystemLoad(systemLoadData);
        setAuditLogs(auditLogsData);
      } catch (error) {
        console.error('Error fetching usage reports data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const downloadCSV = (data: any[], filename: string) => {
    const csv = convertArrayToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const convertArrayToCSV = (data: any[]) => {
    const header = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).join(',')).join('\n');
    return `${header}\n${rows}`;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando relatórios de uso...</div>;
  }

  return (
    <div className="space-y-6">
      {/* User Activity Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Atividade dos Usuários
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(userActivity, 'user_activity_report')}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={userActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="ticketsCreated" fill="#8884d8" name="Tickets Criados" />
              <Bar dataKey="ticketsResolved" fill="#82ca9d" name="Tickets Resolvidos" />
              <Bar dataKey="logins" fill="#ffc658" name="Logins" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ticket Volume Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Volume de Tickets
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(ticketVolume, 'ticket_volume_report')}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ticketVolume}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="totalTickets" stroke="#8884d8" name="Total de Tickets" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Agent Performance Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Desempenho dos Agentes
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(agentPerformance, 'agent_performance_report')}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agentPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agentId" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="ticketsResolved" fill="#8884d8" name="Tickets Resolvidos" />
              <Bar dataKey="avgResolutionTime" fill="#82ca9d" name="Tempo Médio de Resolução" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Knowledge Base Usage Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Uso da Base de Conhecimento
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(knowledgeBaseUsage, 'knowledge_base_usage_report')}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={knowledgeBaseUsage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="articleId" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="views" fill="#8884d8" name="Visualizações" />
              <Bar dataKey="usefulnessRatings" fill="#82ca9d" name="Avaliações de Utilidade" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* System Load Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Carga do Sistema
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(systemLoad, 'system_load_report')}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={systemLoad}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="cpuUsage" stroke="#8884d8" name="Uso da CPU" />
              <Line type="monotone" dataKey="memoryUsage" stroke="#82ca9d" name="Uso da Memória" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Logs de Auditoria
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCSV(auditLogs, 'audit_logs_report')}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full">
            <table className="w-full text-sm">
              <thead className="[&_th]:px-4 [&_th]:py-2 [&_th]:text-left">
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody className="[&_td]:px-4 [&_td]:py-2">
                {auditLogs.map((log, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-muted" : undefined}>
                    <td>{log.timestamp}</td>
                    <td>{log.user}</td>
                    <td>{log.action}</td>
                    <td>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
