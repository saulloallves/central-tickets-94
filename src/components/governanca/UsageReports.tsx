import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  RefreshCw,
  PieChart,
  Clock,
  MapPin,
  Activity,
  FileText
} from "lucide-react";
import { useTickets } from "@/hooks/useTickets";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--critical))', 'hsl(var(--info))'];

export function UsageReports() {
  const { tickets, loading, refetch } = useTickets({
    search: '',
    status: '',
    categoria: '',
    prioridade: '',
    unidade_id: '',
    status_sla: '',
    equipe_id: ''
  });
  const { exportDashboardData } = useDashboardMetrics();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [timeRange, setTimeRange] = useState<number>(30); // dias

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Processar dados para gráficos
  const chartData = useMemo(() => {
    if (!tickets) return { volumeData: [], channelData: [], categoryData: [], unitData: [], hourlyData: [] };

    const now = new Date();
    const filteredTickets = tickets.filter(ticket => {
      const ticketDate = new Date(ticket.data_abertura);
      return ticketDate >= subDays(now, timeRange);
    });

    // Volume temporal
    const volumeData = [];
    const bucketSize = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    
    for (let i = 0; i < timeRange; i += bucketSize) {
      const startDate = subDays(now, i + bucketSize);
      const endDate = subDays(now, i);
      
      const ticketsInPeriod = filteredTickets.filter(ticket => {
        const ticketDate = new Date(ticket.data_abertura);
        return ticketDate >= startDate && ticketDate < endDate;
      });

      volumeData.unshift({
        date: format(startDate, period === 'day' ? 'dd/MM' : period === 'week' ? 'dd/MM' : 'MMM', { locale: ptBR }),
        total: ticketsInPeriod.length,
        concluidos: ticketsInPeriod.filter(t => t.status === 'concluido').length,
        pendentes: ticketsInPeriod.filter(t => t.status !== 'concluido').length
      });
    }

    // Canais de origem
    const channelCounts = filteredTickets.reduce((acc, ticket) => {
      const channel = ticket.canal_origem || 'Não informado';
      acc[channel] = (acc[channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const channelData = Object.entries(channelCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Categorias
    const categoryCounts = filteredTickets.reduce((acc, ticket) => {
      const category = ticket.categoria || 'Não informado';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryData = Object.entries(categoryCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Unidades
    const unitCounts = filteredTickets.reduce((acc, ticket) => {
      const unit = ticket.unidade_id || 'Não informado';
      acc[unit] = (acc[unit] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const unitData = Object.entries(unitCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 unidades

    // Distribuição por hora do dia
    const hourlyCounts = Array.from({ length: 24 }, (_, hour) => {
      const count = filteredTickets.filter(ticket => {
        const ticketHour = new Date(ticket.data_abertura).getHours();
        return ticketHour === hour;
      }).length;
      
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count
      };
    });

    return {
      volumeData,
      channelData,
      categoryData,
      unitData,
      hourlyData: hourlyCounts
    };
  }, [tickets, period, timeRange]);

  const handleExport = () => {
    // Preparar dados específicos para exportação
    const exportData = {
      periodo: period,
      range_dias: timeRange,
      total_tickets: tickets?.length || 0,
      volume_temporal: chartData.volumeData,
      canais: chartData.channelData,
      categorias: chartData.categoryData,
      unidades: chartData.unitData,
      distribuicao_horaria: chartData.hourlyData,
      gerado_em: new Date().toISOString()
    };

    // Converter para CSV
    const csvContent = [
      // Header
      'Relatório de Uso do Sistema',
      `Período: ${period}, Range: ${timeRange} dias`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      '',
      'Volume Temporal',
      'Data,Total,Concluídos,Pendentes',
      ...chartData.volumeData.map(d => `${d.date},${d.total},${d.concluidos},${d.pendentes}`),
      '',
      'Canais de Origem',
      'Canal,Quantidade',
      ...chartData.channelData.map(d => `${d.name},${d.value}`),
      '',
      'Categorias',
      'Categoria,Quantidade',
      ...chartData.categoryData.map(d => `${d.name},${d.value}`),
      '',
      'Unidades',
      'Unidade,Quantidade',
      ...chartData.unitData.map(d => `${d.name},${d.value}`),
      '',
      'Distribuição Horária',
      'Hora,Quantidade',
      ...chartData.hourlyData.map(d => `${d.hour},${d.count}`)
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_uso_sistema_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const peak = chartData.hourlyData.reduce((max, current) => 
    current.count > max.count ? current : max, 
    { hour: '00:00', count: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Relatórios de Uso</h2>
          <p className="text-muted-foreground">Análise de volume e padrões de utilização</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleExport}
            className="liquid-glass-button"
            disabled={loading}
          >
            <FileText className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            onClick={refetch}
            disabled={loading}
            className="liquid-glass-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="liquid-glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Configurações do Relatório</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período de Agrupamento</label>
              <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                <SelectTrigger className="liquid-glass-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Diário</SelectItem>
                  <SelectItem value="week">Semanal</SelectItem>
                  <SelectItem value="month">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Intervalo de Tempo</label>
              <Select value={timeRange.toString()} onValueChange={(value) => setTimeRange(Number(value))}>
                <SelectTrigger className="liquid-glass-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Tickets</p>
                <p className="text-2xl font-bold text-foreground">
                  {tickets?.filter(t => {
                    const ticketDate = new Date(t.data_abertura);
                    return ticketDate >= subDays(new Date(), timeRange);
                  }).length || 0}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Últimos {timeRange} dias
            </p>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Canal Principal</p>
                <p className="text-2xl font-bold text-foreground">
                  {chartData.channelData[0]?.name || 'N/A'}
                </p>
              </div>
              <Activity className="h-8 w-8 text-success" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {chartData.channelData[0]?.value || 0} tickets
            </p>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categoria Principal</p>
                <p className="text-2xl font-bold text-foreground">
                  {chartData.categoryData[0]?.name || 'N/A'}
                </p>
              </div>
              <PieChart className="h-8 w-8 text-warning" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {chartData.categoryData[0]?.value || 0} tickets
            </p>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pico de Chamadas</p>
                <p className="text-2xl font-bold text-foreground">{peak.hour}</p>
              </div>
              <Clock className="h-8 w-8 text-info" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {peak.count} tickets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Temporal */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Volume de Tickets</span>
            </CardTitle>
            <CardDescription>
              Distribuição temporal dos tickets criados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.volumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" name="Total" />
                <Bar dataKey="concluidos" fill="hsl(var(--success))" name="Concluídos" />
                <Bar dataKey="pendentes" fill="hsl(var(--warning))" name="Pendentes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Canais de Origem */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Canais de Origem</span>
            </CardTitle>
            <CardDescription>
              Distribuição por canal de entrada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={chartData.channelData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição Horária */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Picos de Utilização</span>
            </CardTitle>
            <CardDescription>
              Distribuição por hora do dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Unidades */}
        <Card className="liquid-glass-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Top Unidades</span>
            </CardTitle>
            <CardDescription>
              Unidades com maior volume de tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <p className="text-muted-foreground text-center py-4">
                  Carregando métricas das unidades...
                </p>
              ) : chartData.unitData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    Sem dados de unidades
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Não há dados de tickets por unidades no período selecionado ou as métricas não estão disponíveis.
                  </p>
                </div>
              ) : (
                chartData.unitData.slice(0, 8).map((unit, index) => (
                  <div key={unit.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{unit.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {((unit.value / (tickets?.length || 1)) * 100).toFixed(1)}% do total
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {unit.value} tickets
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Detail */}
      <Card className="liquid-glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="h-5 w-5" />
            <span>Análise por Categoria</span>
          </CardTitle>
          <CardDescription>
            Distribuição detalhada de categorias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chartData.categoryData.map((category, index) => (
              <div key={category.name} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium truncate">{category.name}</p>
                  <Badge variant="outline">{category.value}</Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${(category.value / (chartData.categoryData[0]?.value || 1)) * 100}%`,
                      backgroundColor: COLORS[index % COLORS.length]
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((category.value / (tickets?.length || 1)) * 100).toFixed(1)}% do total
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}