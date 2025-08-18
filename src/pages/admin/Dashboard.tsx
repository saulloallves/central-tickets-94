import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useRole } from '@/hooks/useRole';
import { Users, Building2, UserCheck, ClipboardList } from 'lucide-react';

interface Stats {
  unidades: number;
  franqueados: number;
  colaboradores: number;
  tickets: number;
}

const Dashboard = () => {
  const { isAdmin } = useRole();
  const [stats, setStats] = useState<Stats>({
    unidades: 0,
    franqueados: 0,
    colaboradores: 0,
    tickets: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [unidadesResult, franqueadosResult, colaboradoresResult] = await Promise.all([
          supabase.from('unidades').select('id', { count: 'exact', head: true }),
          supabase.from('franqueados').select('Id', { count: 'exact', head: true }),
          supabase.from('colaboradores').select('id', { count: 'exact', head: true })
        ]);

        setStats({
          unidades: unidadesResult.count || 0,
          franqueados: franqueadosResult.count || 0,
          colaboradores: colaboradoresResult.count || 0,
          tickets: 0 // Will be updated when tickets table is created
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-20"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Unidades",
      value: stats.unidades,
      icon: Building2,
      description: "Total de unidades cadastradas"
    },
    {
      title: "Franqueados",
      value: stats.franqueados,
      icon: Users,
      description: "Total de franqueados ativos"
    },
    {
      title: "Colaboradores",
      value: stats.colaboradores,
      icon: UserCheck,
      description: "Total de colaboradores cadastrados"
    },
    {
      title: "Tickets",
      value: stats.tickets,
      icon: ClipboardList,
      description: "Total de tickets abertos"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Visão geral do sistema de gestão de tickets
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin() && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sistema de Tickets</CardTitle>
              <CardDescription>
                Gerencie tickets de suporte e solicitações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                O sistema está configurado e pronto para receber tickets. 
                A integração com WhatsApp via Z-API será implementada na próxima fase.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Database configurado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Autenticação ativa</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">RLS e auditoria configurados</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm">WhatsApp Z-API (pendente)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Próximos Passos</CardTitle>
              <CardDescription>
                Funcionalidades a serem implementadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="border-l-2 border-primary pl-4">
                  <h4 className="font-medium">Parte 2 - Sistema de Tickets</h4>
                  <p className="text-sm text-muted-foreground">
                    Criação de tickets, categorização e fluxo de atendimento
                  </p>
                </div>
                <div className="border-l-2 border-muted pl-4">
                  <h4 className="font-medium">Parte 3 - Integração WhatsApp</h4>
                  <p className="text-sm text-muted-foreground">
                    Integração com Z-API para notificações via WhatsApp
                  </p>
                </div>
                <div className="border-l-2 border-muted pl-4">
                  <h4 className="font-medium">Parte 4 - IA Assistente</h4>
                  <p className="text-sm text-muted-foreground">
                    Sistema de IA para triagem e respostas automáticas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;