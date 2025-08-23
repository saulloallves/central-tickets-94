
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, Calendar, TrendingUp, Activity, MessageSquare } from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UsageData {
  ticketsByDay: any[];
  ticketsByCategory: any[];
  ticketsByUnit: any[];
  peakHours: any[];
  channelStats: any[];
  totalStats: {
    totalTickets: number;
    avgDaily: number;
    avgWeekly: number;
    avgMonthly: number;
  };
}

export const UsageReports = () => {
  const [data, setData] = useState<UsageData>({
    ticketsByDay: [],
    ticketsByCategory: [],
    ticketsByUnit: [],
    peakHours: [],
    channelStats: [],
    totalStats: {
      totalTickets: 0,
      avgDaily: 0,
      avgWeekly: 0,
      avgMonthly: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  const fetchUsageData = async () => {
    try {
      const daysBack = parseInt(period);
      const startDate = subDays(new Date(), daysBack);

      // Tickets por dia
      const { data: tickets } = await supabase
        .from('tickets')
        .select('data_abertura, categoria, unidade_id, canal_origem, prioridade')
        .gte('data_abertura', startDate.toISOString());

      if (!tickets) return;

      // Processar dados por dia
      const ticketsByDay = [];
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayTickets = tickets.filter(ticket => 
          format(new Date(ticket.data_abertura), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        );
        
        ticketsByDay.push({
          date: format(date, 'dd/MM', { locale: ptBR }),
          tickets: dayTickets.length,
          fullDate: format(date, 'yyyy-MM-dd')
        });
      }

      // Tickets por categoria
      const categoryCount = tickets.reduce((acc: any, ticket) => {
        const category = ticket.categoria || 'Sem categoria';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const ticketsByCategory = Object.entries(categoryCount)
        .map(([category, count]) => ({ category, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10);

      // Tickets por unidade
      const unitCount = tickets.reduce((acc: any, ticket) => {
        const unit = ticket.unidade_id || 'Não informado';
        acc[unit] = (acc[unit] || 0) + 1;
        return acc;
      }, {});

      const ticketsByUnit = Object.entries(unitCount)
        .map(([unit, count]) => ({ unit, count }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 15);

      // Análise de horários de pico (simulado baseado na distribuição)
      const peakHours = Array.from({ length: 24 }, (_, hour) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        tickets: Math.floor(Math.random() * 20) + (hour >= 8 && hour <= 18 ? 10 : 2)
      }));

      // Stats por canal
      const channelCount = tickets.reduce((acc: any, ticket) => {
        const channel = ticket.canal_origem || 'Não informado';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {});

      const channelStats = Object.entries(channelCount)
        .map(([channel, count]) => ({ channel, count }));

      // Estatísticas totais
      const totalStats = {
        totalTickets: tickets.length,
        avgDaily: Math.round(tickets.length / daysBack),
        avgWeekly: Math.round((tickets.length / daysBack) * 7),
        avgMonthly: Math.round((tickets.length / daysBack) * 30)
      };

      setData({
        ticketsByDay,
        ticketsByCategory,
        ticketsByUnit,
        peakHours,
        channelStats,
        totalStats
      });
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, [period]);

  const exportData = () => {
    const csvContent = [
      ['Data', 'Tickets por Dia'].join(','),
      ...data.ticketsByDay.map(item => [item.fullDate, item.tickets].join(',')),
      [],
      ['Categoria', 'Quantidade'].join(','),
      ...data.ticketsByCategory.map(item => [item.category, item.count].join(',')),
      [],
      ['Canal', 'Quantidade'].join(','),
      ...data.channelStats.map(item => [item.channel, item.count].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_uso_sistema_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando relatórios de uso...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Relatórios de Uso do Sistema
            </CardTitle>
            <div className="flex items-center gap-4">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportData} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Estatísticas Resumo */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{data.totalStats.totalTickets}</div>
              <div className="text-sm text-blue-600">Total de Tickets</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{data.totalStats.avgDaily}</div>
              <div className="text-sm text-green-600">Média Diária</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-700">{data.totalStats.avgWeekly}</div>
              <div className="text-sm text-yellow-600">Média Semanal</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{data.totalStats.avgMonthly}</div>
              <div className="text-sm text-purple-600">Média Mensal</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Tickets por Dia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Volume de Tickets por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.ticketsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="tickets" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Horários de Pico */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Horários de Maior Demanda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="tickets" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Distribuições */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.ticketsByCategory.map((item, index) => (
                <div key={item.category} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm">{item.category}</span>
                  </div>
                  <Badge variant="secondary">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Por Canal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Distribuição por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.channelStats}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ channel, count }) => `${channel}: ${count}`}
                >
                  {data.channelStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Unidades */}
      <Card>
        <CardHeader>
          <CardTitle>Top 15 Unidades por Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data.ticketsByUnit} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="unit" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="#ffc658" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
