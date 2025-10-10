import { useState, useEffect, useMemo } from 'react';
import { useTicketNotifications } from '@/hooks/useTicketNotifications';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { Plus, Filter, Calendar, Users, Clock, AlertTriangle, Brain, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TicketsKanban } from '@/components/tickets/TicketsKanban';
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { CrisisBanner } from '@/components/tickets/CrisisBanner';
import { NotificationButton } from '@/components/notifications/NotificationButton';
import { useTicketsEdgeFunctions } from '@/hooks/useTicketsEdgeFunctions';
import { BulkAnalysisDialog } from '@/components/tickets/BulkAnalysisDialog';
import { useUserEquipes } from '@/hooks/useUserEquipes';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { TestFranqueadoNotification } from '@/components/notifications/TestFranqueadoNotification';

const Tickets = () => {
  const { isAdmin, isSupervisor } = useRole();
  const {
    userEquipes
  } = useUserEquipes();
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();

  // Remove useRealtimeNotifications from here to avoid conflicts
  // useRealtimeNotifications();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [bulkAnalysisOpen, setBulkAnalysisOpen] = useState(false);
  const [selectedEquipeForAnalysis, setSelectedEquipeForAnalysis] = useState<string>('');

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
  const [localFilters, setLocalFilters] = useState({
    search: '',
    status: 'all',
    categoria: 'all',
    prioridade: 'all',
    unidade_id: 'all',
    status_sla: 'all',
    equipe_id: 'all'
  });
  
  // Debounced filters para evitar piscamento
  const [debouncedFilters, setDebouncedFilters] = useState(localFilters);
  const [isFilterChanged, setIsFilterChanged] = useState(false);

  // Detectar se os filtros mudaram
  useEffect(() => {
    const hasChanged = JSON.stringify(localFilters) !== JSON.stringify(debouncedFilters);
    setIsFilterChanged(hasChanged);
  }, [localFilters, debouncedFilters]);

  // Função para aplicar filtros manualmente
  const handleApplyFilters = () => {
    console.log('🔍 Aplicando filtros manualmente:', localFilters);
    setDebouncedFilters(localFilters);
    setIsFilterChanged(false);
    refetch(); // Força refresh do Kanban
  };

  // Função para limpar filtros
  const handleClearFilters = () => {
    const clearedFilters = {
      search: '',
      status: 'all',
      categoria: 'all',
      prioridade: 'all',
      unidade_id: 'all',
      status_sla: 'all',
      equipe_id: 'all'
    };
    setLocalFilters(clearedFilters);
    setDebouncedFilters(clearedFilters);
    setIsFilterChanged(false);
    refetch();
  };
  
  const {
    tickets,
    loading,
    ticketStats,
    lastUpdate,
    refetch,
    createTicket,
    updateTicket,
    deleteTicket,
    moveTicket,
  } = useTicketsEdgeFunctions(debouncedFilters);

  // Listen for ticket transferred events to update Kanban (MOVED AFTER refetch declaration)
  useEffect(() => {
    const handleTicketTransferred = (event: CustomEvent) => {
      console.log('🔄 Ticket transferido detectado. Atualizando Kanban...', event.detail);
      refetch();
    };
    window.addEventListener('ticket-transferred', handleTicketTransferred as EventListener);
    return () => {
      window.removeEventListener('ticket-transferred', handleTicketTransferred as EventListener);
    };
  }, [refetch]);

  // OPTIMIZED: Use userEquipes instead of separate fetch
  // Convert userEquipes to format for compatibility
  const equipes = userEquipes
    .filter(ue => ue.equipes.ativo)
    .map(ue => ({
      id: ue.equipes.id,
      nome: ue.equipes.nome,
      ativo: ue.equipes.ativo
    }));

  // Edge functions handle realtime automatically through database triggers

  const handleTicketSelect = (ticketId: string) => {
    setSelectedTicketId(ticketId);
  };
  const handleCloseDetail = () => {
    setSelectedTicketId(null);
  };
  const getSLABadgeVariant = (status: string) => {
    switch (status) {
      case 'vencido':
        return 'destructive';
      case 'alerta':
        return 'outline';
      default:
        return 'secondary';
    }
  };
  return <div className="relative">
      {/* New Crisis Alert Banner */}
      {/* Sistema de crises removido */}
      
      <div className="w-full p-3 md:p-6 space-y-3 md:space-y-4">
        {/* Banner de Crises */}
        <CrisisBanner />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl md:text-3xl font-bold tracking-tight">Tickets de Suporte</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Gerencie tickets de suporte e acompanhe SLAs
              </p>
            </div>
            {(debouncedFilters.search || debouncedFilters.status !== 'all' || debouncedFilters.prioridade !== 'all' || debouncedFilters.equipe_id !== 'all') && (
              <Badge variant="secondary" className="text-sm">
                {tickets.length} {tickets.length === 1 ? 'resultado' : 'resultados'}
              </Badge>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1 md:gap-2">
            <NotificationButton isExpanded={false} variant="tickets" />
          </div>
        </div>


        {/* Stats Cards - Simplified */}
        <div className="grid grid-cols-3 md:grid-cols-3 gap-2 md:gap-4">
          <Card className="p-2 md:p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-2 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium">Tickets Hoje</CardTitle>
              <Users className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-2 md:p-6 pt-0">
              <div className="text-lg md:text-2xl font-bold">{ticketStats?.total || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="p-2 md:p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-2 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium">SLA Vencido</CardTitle>
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 text-destructive" />
            </CardHeader>
            <CardContent className="p-2 md:p-6 pt-0">
              <div className="text-lg md:text-2xl font-bold text-destructive">
                {ticketStats?.sla_vencido || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card className="p-2 md:p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-2 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium">Em Atendimento</CardTitle>
              <Clock className="h-3 w-3 md:h-4 md:w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-2 md:p-6 pt-0">
              <div className="text-lg md:text-2xl font-bold">{ticketStats?.em_atendimento || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Badge de filtros ativos */}
        {(localFilters.search || 
          localFilters.status !== 'all' || 
          localFilters.prioridade !== 'all' ||
          localFilters.equipe_id !== 'all') && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium flex-1">
              {[
                localFilters.search && `Busca: "${localFilters.search}"`,
                localFilters.status !== 'all' && `Status: ${localFilters.status}`,
                localFilters.prioridade !== 'all' && `Prioridade: ${localFilters.prioridade}`,
                localFilters.equipe_id !== 'all' && `Equipe filtrada`
              ].filter(Boolean).join(' • ')}
            </span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClearFilters}
            >
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          </div>
        )}

        {/* Collapsible Filters */}
        {showFilters && <Card className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border/40">
            <CardContent className="p-4">
              <div className="flex gap-4 items-center flex-wrap">
                <div className="relative">
                  <Input 
                    placeholder="Buscar tickets..." 
                    value={localFilters.search} 
                    onChange={e => setLocalFilters(prev => ({
                      ...prev,
                      search: e.target.value
                    }))} 
                    className={cn(
                      "max-w-xs pr-8",
                      isFilterChanged && localFilters.search !== debouncedFilters.search && "border-yellow-500 border-2"
                    )}
                  />
                  {isFilterChanged && localFilters.search !== debouncedFilters.search && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-500 text-xs">
                        Não aplicado
                      </Badge>
                    </div>
                  )}
                </div>
                
                <Select 
                  value={localFilters.prioridade} 
                  onValueChange={value => setLocalFilters(prev => ({
                    ...prev,
                    prioridade: value
                  }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border z-50 shadow-lg">
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="crise">Crise</SelectItem>
                    <SelectItem value="imediato">Imediato (15min)</SelectItem>
                    <SelectItem value="alto">Alto (1 hora)</SelectItem>
                    <SelectItem value="medio">Médio (10 horas)</SelectItem>
                    <SelectItem value="baixo">Baixo (24 horas)</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select 
                  value={localFilters.equipe_id} 
                  onValueChange={value => setLocalFilters(prev => ({
                    ...prev,
                    equipe_id: value
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Equipe" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border z-50 shadow-lg">
                    <SelectItem value="all">Todas Equipes</SelectItem>
                    {userEquipes.length > 0 && <SelectItem value="minhas_equipes">Minhas Equipes</SelectItem>}
                    {equipes.map(equipe => <SelectItem key={equipe.id} value={equipe.id}>
                        {equipe.nome}
                      </SelectItem>)}
                  </SelectContent>
                </Select>

                {(isAdmin || isSupervisor) && <Select 
                  value={localFilters.unidade_id} 
                  onValueChange={value => setLocalFilters(prev => ({
                    ...prev,
                    unidade_id: value
                  }))}
                >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-border z-50 shadow-lg">
                      <SelectItem value="all">Todas</SelectItem>
                    </SelectContent>
                  </Select>}
                
                {/* Botões de ação dos filtros */}
                <div className="flex gap-2 items-center ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    disabled={!isFilterChanged && localFilters.search === '' && localFilters.prioridade === 'all' && localFilters.equipe_id === 'all'}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleApplyFilters}
                    disabled={!isFilterChanged}
                    className={cn(
                      "min-w-[140px]",
                      isFilterChanged && "animate-pulse bg-primary"
                    )}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Aplicar Filtros
                    {isFilterChanged && (
                      <Badge variant="secondary" className="ml-2 bg-yellow-500 text-white">
                        !
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>}

        {/* Main Content */}
        <TicketsKanban 
          tickets={tickets} 
          loading={loading} 
          onTicketSelect={handleTicketSelect} 
          selectedTicketId={selectedTicketId} 
          equipes={equipes} 
          showFilters={showFilters} 
          onToggleFilters={() => setShowFilters(!showFilters)} 
          lastUpdate={lastUpdate}
          onChangeStatus={async (ticketId, fromStatus, toStatus, beforeId, afterId) => {
            const success = await moveTicket(ticketId, toStatus, beforeId, afterId);
            return success;
          }} 
        />

        <CreateTicketDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onCreateTicket={createTicket} />

        {/* Modal de Ticket */}
        <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
          <DialogContent className="w-[96vw] max-w-6xl h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>Detalhes do Ticket</DialogTitle>
              <DialogDescription>Visualização completa dos detalhes do ticket</DialogDescription>
            </DialogHeader>
            {selectedTicketId && <TicketDetail ticketId={selectedTicketId} onClose={() => {
            setTicketModalOpen(false);
            setSelectedTicketId(null);
          }} />}
          </DialogContent>
        </Dialog>

        {/* Bulk Analysis Dialog */}
        <BulkAnalysisDialog 
          open={bulkAnalysisOpen}
          onOpenChange={setBulkAnalysisOpen}
          equipeId={selectedEquipeForAnalysis || equipes[0]?.id || ''}
          equipeNome={equipes.find(e => e.id === selectedEquipeForAnalysis)?.nome || equipes[0]?.nome || 'Equipe'}
        />
      </div>
    </div>;
};
export default Tickets;