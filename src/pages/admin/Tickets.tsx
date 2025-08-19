import { useState, useEffect } from 'react';
import { Plus, Filter, Calendar, Users, Clock, AlertTriangle, List, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRole } from '@/hooks/useRole';
import { TicketsList } from '@/components/tickets/TicketsList';
import { TicketsKanban } from '@/components/tickets/TicketsKanban';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog';
import { SLAAlerts } from '@/components/tickets/SLAAlerts';
import { TestAIButton } from '@/components/tickets/TestAIButton';
import { RefreshButton } from '@/components/ui/refresh-button';
import { NotificationButton } from '@/components/notifications/NotificationButton';
import { useTickets } from '@/hooks/useTickets';
import { useUserEquipes } from '@/hooks/useUserEquipes';
import { supabase } from '@/integrations/supabase/client';

interface Equipe {
  id: string;
  nome: string;
  ativo: boolean;
}

const Tickets = () => {
  const { isAdmin, isGerente } = useRole();
  const { userEquipes } = useUserEquipes();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    categoria: 'all',
    prioridade: 'all',
    unidade_id: 'all',
    status_sla: 'all',
    equipe_id: 'all'
  });

  const { ticketStats, refetch } = useTickets(filters);

  // Fetch available teams
  useEffect(() => {
    const fetchEquipes = async () => {
      try {
        const { data, error } = await supabase
          .from('equipes')
          .select('id, nome, ativo')
          .eq('ativo', true)
          .order('nome');

        if (!error && data) {
          setEquipes(data);
        }
      } catch (error) {
        console.error('Error fetching equipes:', error);
      }
    };

    fetchEquipes();
  }, []);

  const handleTicketSelect = (ticketId: string) => {
    setSelectedTicketId(ticketId);
  };

  const handleCloseDetail = () => {
    setSelectedTicketId(null);
  };

  const getSLABadgeVariant = (status: string) => {
    switch (status) {
      case 'vencido': return 'destructive';
      case 'alerta': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets de Suporte</h1>
          <p className="text-muted-foreground">
            Gerencie tickets de suporte e acompanhe SLAs
          </p>
        </div>
        
        <div className="flex gap-2">
          <div className="flex border rounded-lg p-1">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
          </div>
          <NotificationButton />
          <RefreshButton onRefresh={refetch} />
          <TestAIButton />
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards - Simplified */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketStats?.total || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {ticketStats?.sla_vencido || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketStats?.em_atendimento || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Updated Filters - replaced categoria with equipe */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Buscar tickets..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="max-w-xs"
            />
            
            <Select value={filters.prioridade} onValueChange={(value) => setFilters(prev => ({ ...prev, prioridade: value }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="crise">Crise</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="hoje_18h">Hoje até 18h</SelectItem>
                <SelectItem value="padrao_24h">Padrão (24h)</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.equipe_id} onValueChange={(value) => setFilters(prev => ({ ...prev, equipe_id: value }))}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Equipes</SelectItem>
                {userEquipes.length > 0 && (
                  <SelectItem value="minhas_equipes">Minhas Equipes</SelectItem>
                )}
                {equipes.map((equipe) => (
                  <SelectItem key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(isAdmin || isGerente) && (
              <Select value={filters.unidade_id} onValueChange={(value) => setFilters(prev => ({ ...prev, unidade_id: value }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      {viewMode === 'kanban' ? (
        <TicketsKanban 
          filters={filters}
          onTicketSelect={handleTicketSelect}
          selectedTicketId={selectedTicketId}
          equipes={equipes}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TicketsList 
              filters={filters}
              onTicketSelect={handleTicketSelect}
              selectedTicketId={selectedTicketId}
            />
          </div>
          
          <div>
            {selectedTicketId ? (
              <TicketDetail 
                ticketId={selectedTicketId}
                onClose={handleCloseDetail}
              />
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <p>Selecione um ticket para ver os detalhes</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <CreateTicketDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
};

export default Tickets;
