
import { useState, useEffect } from 'react';
import { useTicketNotifications } from '@/hooks/useTicketNotifications';
import { Plus, Filter, Calendar, Users, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRole } from '@/hooks/useRole';
import { TicketsKanban } from '@/components/tickets/TicketsKanban';
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { SLAAlerts } from '@/components/tickets/SLAAlerts';
import { TestAIButton } from '@/components/tickets/TestAIButton';
import { RefreshButton } from '@/components/ui/refresh-button';
import { NotificationButton } from '@/components/notifications/NotificationButton';
import { NewCrisisAlertBanner } from '@/components/crisis/NewCrisisAlertBanner';
import { NewCrisisPanel } from '@/components/crisis/NewCrisisPanel';
import { useTickets } from '@/hooks/useTickets';
import { useUserEquipes } from '@/hooks/useUserEquipes';
import { useTicketsRealtime } from '@/hooks/useTicketsRealtime';
import { supabase } from '@/integrations/supabase/client';

interface Equipe {
  id: string;
  nome: string;
  ativo: boolean;
}

const Tickets = () => {
  const { isAdmin, isGerente } = useRole();
  const { userEquipes } = useUserEquipes();
  
  // Inicializar notificações sonoras
  const { testNotificationSound } = useTicketNotifications();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  
  // Listen for notification ticket modal events
  useEffect(() => {
    const handleOpenTicketModal = (event: CustomEvent) => {
      console.log('Received openTicketModal event:', event.detail);
      setSelectedTicketId(event.detail.ticketId);
      setTicketModalOpen(true);
    };
    
    window.addEventListener('openTicketModal', handleOpenTicketModal as EventListener);
    
    return () => {
      window.removeEventListener('openTicketModal', handleOpenTicketModal as EventListener);
    };
  }, []);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showCrisisPanel, setShowCrisisPanel] = useState(false);
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

  const { 
    tickets,
    loading,
    ticketStats, 
    refetch, 
    handleTicketUpdate, 
    handleTicketInsert, 
    handleTicketDelete,
    changeTicketStatus
  } = useTickets(filters);

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

  // Setup realtime subscription with optimized filtering
  useTicketsRealtime({
    onTicketUpdate: handleTicketUpdate,
    onTicketInsert: handleTicketInsert,
    onTicketDelete: handleTicketDelete,
    filters: {
      unidade_id: filters.unidade_id !== 'all' ? filters.unidade_id : undefined,
      equipe_id: filters.equipe_id !== 'all' ? filters.equipe_id : undefined,
      status: filters.status !== 'all' ? [filters.status] : undefined,
    }
  });

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
    <div className="relative">
      {/* New Crisis Alert Banner */}
      <NewCrisisAlertBanner />
      
      <div className="p-6 space-y-6" style={{ paddingTop: '6rem' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tickets de Suporte</h1>
            <p className="text-muted-foreground">
              Gerencie tickets de suporte e acompanhe SLAs
            </p>
          </div>
          
          <div className="flex gap-2">
            <NotificationButton />
            <RefreshButton onRefresh={() => {
              console.log('🔄 Manual refresh triggered');
              refetch();
            }} />
            <Button variant="outline" onClick={() => {
              console.log('🔄 Force refresh all data');
              window.location.reload();
            }}>
              ↻ Refresh Completo
            </Button>
            <Button variant="outline" onClick={testNotificationSound}>
              🔊 Testar Som
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowCrisisPanel(!showCrisisPanel)}
              className={showCrisisPanel ? "bg-red-50 border-red-200" : ""}
              data-crisis-panel-trigger
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Painel de Crises
            </Button>
            <TestAIButton />
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Ticket
            </Button>
          </div>
        </div>

        {/* Crisis Panel */}
        {showCrisisPanel && (
          <NewCrisisPanel className="mb-6" />
        )}

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

        {/* Collapsible Filters */}
        {showFilters && (
          <Card className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border/40">
            <CardContent className="p-4">
              <div className="flex gap-4 items-center flex-wrap">
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
                  <SelectContent className="bg-background border-border z-50 shadow-lg">
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="crise">Crise</SelectItem>
                    <SelectItem value="imediato">Imediato (15min)</SelectItem>
                    <SelectItem value="ate_1_hora">Até 1 hora</SelectItem>
                    <SelectItem value="ainda_hoje">Ainda Hoje (18h)</SelectItem>
                    <SelectItem value="posso_esperar">Posso Esperar (24h)</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filters.equipe_id} onValueChange={(value) => setFilters(prev => ({ ...prev, equipe_id: value }))}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Equipe" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border z-50 shadow-lg">
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
                    <SelectContent className="bg-background border-border z-50 shadow-lg">
                      <SelectItem value="all">Todas</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <TicketsKanban 
          tickets={tickets}
          loading={loading}
          onTicketSelect={handleTicketSelect}
          selectedTicketId={selectedTicketId}
          equipes={equipes}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onChangeStatus={(ticketId, fromStatus, toStatus, beforeId, afterId) => 
            changeTicketStatus(ticketId, fromStatus, toStatus, beforeId, afterId)
          }
        />

        <CreateTicketDialog 
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />

        {/* Modal de Ticket */}
        <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
          <DialogContent className="w-[96vw] max-w-6xl h-[90vh] p-0 overflow-hidden">
            {selectedTicketId && (
              <TicketDetail 
                ticketId={selectedTicketId}
                onClose={() => {
                  setTicketModalOpen(false);
                  setSelectedTicketId(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Tickets;
