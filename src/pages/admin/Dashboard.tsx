import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { KPICard } from '@/components/dashboard/KPICard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useRole } from '@/hooks/useRole';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { 
  Download, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Users,
  Building2,
  Bot,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Dashboard = () => {
  const { isAdmin, isDiretor, isGerente } = useRole();
  const {
    kpis,
    trends,
    teamMetrics,
    unitMetrics,
    loading,
    fetchKPIs,
    fetchTrends,
    fetchTicketsByCategory,
    fetchTicketsByEquipe,
    exportDashboardData
  } = useDashboardMetrics();

  const [filters, setFilters] = useState({
    periodo_dias: 30,
    unidade_filter: '',
    equipe_filter: ''
  });
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [teamData, setTeamData] = useState<any[]>([]);

  useEffect(() => {
    if (kpis) {
      loadChartData();
    }
  }, [kpis]);

  const loadChartData = async () => {
    const [categories, teams] = await Promise.all([
      fetchTicketsByCategory(),
      fetchTicketsByEquipe()
    ]);
    setCategoryData(categories);
    setTeamData(teams);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    if (key === 'periodo_dias') {
      fetchKPIs({ ...newFilters, periodo_dias: parseInt(value) });
      fetchTrends({ dias: parseInt(value) });
    } else {
      fetchKPIs(newFilters);
    }
  };

  const getKPIColor = (value: number, type: 'sla' | 'ia' | 'resolucao') => {
    switch (type) {
      case 'sla':
        if (value >= 90) return 'success';
        if (value >= 70) return 'warning';
        return 'danger';
      case 'ia':
        if (value >= 80) return 'success';
        if (value >= 60) return 'warning';
        return 'danger';
      case 'resolucao':
        if (value >= 85) return 'success';
        if (value >= 70) return 'warning';
        return 'danger';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do desempenho e métricas em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={(value) => handleFilterChange('periodo_dias', value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => exportDashboardData(filters)} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total de Tickets"
          value={kpis?.total_tickets || 0}
          description={`${kpis?.periodo_dias || 30} dias`}
          icon={<BarChart3 className="h-4 w-4" />}
          loading={loading}
        />
        
        <KPICard
          title="SLA Cumprido"
          value={`${kpis?.percentual_sla || 0}%`}
          description={`${kpis?.tickets_sla_ok || 0} de ${kpis?.total_tickets || 0} tickets`}
          color={getKPIColor(kpis?.percentual_sla || 0, 'sla')}
          icon={<CheckCircle className="h-4 w-4" />}
          loading={loading}
        />
        
        <KPICard
          title="Tempo Médio"
          value={`${kpis?.tempo_medio_resolucao || 0}h`}
          description="Resolução de tickets"
          icon={<Clock className="h-4 w-4" />}
          loading={loading}
        />
        
        <KPICard
          title="IA Sucesso"
          value={`${kpis?.percentual_ia_sucesso || 0}%`}
          description={`${kpis?.ia_usada_sucesso || 0} interações bem-sucedidas`}
          color={getKPIColor(kpis?.percentual_ia_sucesso || 0, 'ia')}
          icon={<Bot className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* Additional KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Tickets Abertos"
          value={kpis?.tickets_abertos || 0}
          description="Aguardando atendimento"
          color={kpis?.tickets_abertos && kpis.tickets_abertos > 20 ? 'warning' : 'default'}
          icon={<Activity className="h-4 w-4" />}
          loading={loading}
        />
        
        <KPICard
          title="Tickets de Crise"
          value={kpis?.tickets_crise || 0}
          description="Prioridade crítica"
          color={kpis?.tickets_crise && kpis.tickets_crise > 0 ? 'danger' : 'success'}
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={loading}
        />
        
        <KPICard
          title="Equipes Ativas"
          value={kpis?.equipes_ativas || 0}
          description="Atendendo tickets"
          icon={<Users className="h-4 w-4" />}
          loading={loading}
        />
        
        <KPICard
          title="Unidades Ativas"
          value={kpis?.unidades_ativas || 0}
          description="Com tickets no período"
          icon={<Building2 className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Tendências</TabsTrigger>
          <TabsTrigger value="categories">Por Categoria</TabsTrigger>
          <TabsTrigger value="teams">Por Equipe</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Tickets</CardTitle>
              <CardDescription>
                Acompanhe a evolução diária dos tickets e tempo de resolução
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="data"
                    tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="total_tickets" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="Total Tickets"
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="tickets_resolvidos" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="Resolvidos"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="tempo_medio_resolucao" 
                    stroke="#ff7300" 
                    strokeWidth={2}
                    name="Tempo Médio (h)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Categorias</CardTitle>
                <CardDescription>Categorias com mais tickets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryData.slice(0, 6).map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-sm font-medium">{category.name}</span>
                      </div>
                      <Badge variant="secondary">{category.value}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance por Equipe</CardTitle>
              <CardDescription>
                Tickets processados e tempo médio de resolução por equipe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={teamMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="equipe_nome" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar 
                    yAxisId="left"
                    dataKey="total_tickets" 
                    fill="#8884d8" 
                    name="Total Tickets"
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="tickets_resolvidos" 
                    fill="#82ca9d" 
                    name="Resolvidos"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Team Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle>Ranking de Equipes</CardTitle>
                <CardDescription>Performance das equipes nos últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamMetrics.slice(0, 5).map((team, index) => (
                    <div key={team.equipe_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{team.equipe_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {team.total_tickets} tickets | {(team.tempo_medio_resolucao || 0).toFixed(1)}h médio
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {team.total_tickets > 0 ? 
                            ((team.tickets_sla_ok / team.total_tickets) * 100).toFixed(1) : 0}% SLA
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {team.tickets_resolvidos} resolvidos
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Unit Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Top Unidades</CardTitle>
                <CardDescription>Unidades com mais atividade</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {unitMetrics.slice(0, 5).map((unit, index) => (
                    <div key={unit.unidade_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{unit.unidade_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {unit.total_tickets_mes} tickets este mês
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={unit.percentual_sla >= 90 ? "default" : unit.percentual_sla >= 70 ? "secondary" : "destructive"}
                        >
                          {unit.percentual_sla}% SLA
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {unit.tickets_resolvidos} resolvidos
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;