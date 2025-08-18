import { useState } from 'react';
import { Plus, Filter, Calendar, Users, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRole } from '@/hooks/useRole';
import { TicketsList } from '@/components/tickets/TicketsList';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog';
import { useTickets } from '@/hooks/useTickets';

const Tickets = () => {
  const { isAdmin, isGerente } = useRole();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    categoria: '',
    prioridade: '',
    unidade_id: '',
    status_sla: ''
  });

  const { ticketStats } = useTickets(filters);

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
        
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Ticket
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {ticketStats?.novos || 0} abertos hoje
            </p>
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
            <p className="text-xs text-muted-foreground">
              Requer atenção imediata
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atendimento</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketStats?.em_atendimento || 0}</div>
            <p className="text-xs text-muted-foreground">
              Sendo processados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {ticketStats?.tempo_medio ? `${Math.round(ticketStats.tempo_medio)}h` : '0h'}
            </div>
            <p className="text-xs text-muted-foreground">
              Resolução média
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Input
              placeholder="Buscar tickets..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
            
            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                <SelectItem value="escalonado">Escalonado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.categoria} onValueChange={(value) => setFilters(prev => ({ ...prev, categoria: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                <SelectItem value="juridico">Jurídico</SelectItem>
                <SelectItem value="sistema">Sistema</SelectItem>
                <SelectItem value="midia">Mídia</SelectItem>
                <SelectItem value="operacoes">Operações</SelectItem>
                <SelectItem value="rh">RH</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.prioridade} onValueChange={(value) => setFilters(prev => ({ ...prev, prioridade: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                <SelectItem value="crise">Crise</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="hoje_18h">Hoje até 18h</SelectItem>
                <SelectItem value="padrao_24h">Padrão (24h)</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.status_sla} onValueChange={(value) => setFilters(prev => ({ ...prev, status_sla: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="SLA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="dentro_prazo">Dentro do Prazo</SelectItem>
                <SelectItem value="alerta">Alerta</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
            
            {(isAdmin || isGerente) && (
              <Select value={filters.unidade_id} onValueChange={(value) => setFilters(prev => ({ ...prev, unidade_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {/* Unidades will be loaded dynamically */}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
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

      <CreateTicketDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
};

export default Tickets;