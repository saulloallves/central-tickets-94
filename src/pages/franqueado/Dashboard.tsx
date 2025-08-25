import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useFranqueadoUnits } from '@/hooks/useFranqueadoUnits';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Ticket, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface TicketKPIs {
  totalTickets: number;
  abertos: number;
  emAtendimento: number;
  escalonados: number;
  slaVencido: number;
}

interface UnitSummary {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  ticketsAbertos: number;
  ticketsTotal: number;
}

interface RecentTicket {
  id: string;
  codigo_ticket: string;
  descricao_problema: string;
  status: string;
  prioridade: string;
  data_abertura: string;
  unidade_id: string;
}

export default function FranqueadoDashboard() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { units, loading: unitsLoading } = useFranqueadoUnits();
  const navigate = useNavigate();
  
  const [ticketKPIs, setTicketKPIs] = useState<TicketKPIs>({
    totalTickets: 0,
    abertos: 0,
    emAtendimento: 0,
    escalonados: 0,
    slaVencido: 0,
  });
  const [unitSummaries, setUnitSummaries] = useState<UnitSummary[]>([]);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!units || units.length === 0) {
      setLoading(false);
      return;
    }

    const fetchTicketData = async () => {
      try {
        const unitIds = units.map(unit => unit.id);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Fetch tickets for franqueado units
        const { data: tickets, error } = await supabase
          .from('tickets')
          .select(`
            id,
            codigo_ticket,
            descricao_problema,
            status,
            prioridade,
            status_sla,
            data_abertura,
            unidade_id
          `)
          .in('unidade_id', unitIds)
          .gte('data_abertura', thirtyDaysAgo.toISOString())
          .order('data_abertura', { ascending: false });

        if (error) throw error;

        // Calculate KPIs
        const kpis: TicketKPIs = {
          totalTickets: tickets?.length || 0,
          abertos: tickets?.filter(t => t.status === 'aberto').length || 0,
          emAtendimento: tickets?.filter(t => t.status === 'em_atendimento').length || 0,
          escalonados: tickets?.filter(t => t.status === 'escalonado' || t.prioridade === 'crise').length || 0,
          slaVencido: tickets?.filter(t => t.status_sla === 'vencido').length || 0,
        };

        // Calculate unit summaries
        const summaries: UnitSummary[] = units.map(unit => {
          const unitTickets = tickets?.filter(t => t.unidade_id === unit.id) || [];
          const openTickets = unitTickets.filter(t => t.status !== 'concluido').length;
          return {
            id: unit.id,
            nome: unit.grupo,
            cidade: unit.cidade,
            uf: unit.uf,
            ticketsAbertos: openTickets,
            ticketsTotal: unitTickets.length,
          };
        });

        // Get 5 most recent tickets
        const recent = tickets?.slice(0, 5).map(ticket => ({
          id: ticket.id,
          codigo_ticket: ticket.codigo_ticket,
          descricao_problema: ticket.descricao_problema,
          status: ticket.status,
          prioridade: ticket.prioridade,
          data_abertura: ticket.data_abertura,
          unidade_id: ticket.unidade_id,
        })) || [];

        setTicketKPIs(kpis);
        setUnitSummaries(summaries);
        setRecentTickets(recent);
      } catch (error) {
        console.error('Error fetching ticket data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketData();
  }, [units]);

  const getStatusBadge = (status: string) => {
    const statusMap = {
      aberto: { label: 'Aberto', variant: 'destructive' as const },
      em_atendimento: { label: 'Em Atendimento', variant: 'default' as const },
      escalonado: { label: 'Escalonado', variant: 'secondary' as const },
      concluido: { label: 'Concluído', variant: 'outline' as const },
    };
    
    const config = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap = {
      imediato: { label: 'Imediato', variant: 'destructive' as const },
      crise: { label: 'Crise', variant: 'destructive' as const },
      ate_1_hora: { label: 'Até 1h', variant: 'secondary' as const },
      ainda_hoje: { label: 'Hoje', variant: 'default' as const },
      posso_esperar: { label: 'Posso Esperar', variant: 'outline' as const },
    };
    
    const config = priorityMap[priority as keyof typeof priorityMap] || { label: priority, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (unitsLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Bem-vindo, {profile?.nome_completo || user?.email?.split('@')[0]}!
        </h1>
        <p className="text-muted-foreground">
          Visão geral dos tickets e unidades
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Minhas Unidades
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{units?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Unidades ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tickets Abertos
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketKPIs.abertos}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando atendimento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Em Atendimento
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketKPIs.emAtendimento}</div>
            <p className="text-xs text-muted-foreground">
              Sendo processados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              SLA Vencido
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{ticketKPIs.slaVencido}</div>
            <p className="text-xs text-muted-foreground">
              Requer atenção
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumo por Unidade</CardTitle>
            <CardDescription>
              Tickets por unidade nos últimos 30 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unitSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma unidade encontrada
              </p>
            ) : (
              <div className="space-y-4">
                {unitSummaries.map((unit) => (
                  <div key={unit.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{unit.nome}</p>
                      <p className="text-sm text-muted-foreground">{unit.cidade} - {unit.uf}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{unit.ticketsAbertos} abertos</p>
                      <p className="text-sm text-muted-foreground">{unit.ticketsTotal} total</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Últimos Tickets</CardTitle>
              <CardDescription>
                5 tickets mais recentes
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/franqueado/tickets')}
            >
              Ver todos <ExternalLink className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum ticket encontrado
              </p>
            ) : (
              <div className="space-y-4">
                {recentTickets.map((ticket) => (
                  <div key={ticket.id} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{ticket.codigo_ticket}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {ticket.descricao_problema}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 ml-2">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.prioridade)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ticket.data_abertura).toLocaleDateString('pt-BR')}
                    </p>
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