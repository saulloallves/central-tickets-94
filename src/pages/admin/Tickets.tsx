
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
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
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
import { useEnhancedTicketRealtime } from '@/hooks/useEnhancedTicketRealtime';
import { useTicketFallbackPolling } from '@/hooks/useTicketFallbackPolling';

import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Equipe {
  id: string;
  nome: string;
  ativo: boolean;
}

const Tickets = () => {
  const { isAdmin, isSupervisor } = useRole();
  const { userEquipes } = useUserEquipes();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Initialize notification system
  const { testNotificationSound, testCriticalSound } = useTicketNotifications();
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

  // Real-time updates using ENHANCED enhanced hook
  const { isConnected, isDegraded, status, retryCount, realtimeAttempted } = useEnhancedTicketRealtime({
    onTicketInsert: handleTicketInsert,
    onTicketUpdate: handleTicketUpdate,
    onTicketDelete: handleTicketDelete,
    filters: {
      unidade_id: filters.unidade_id !== 'all' ? filters.unidade_id : undefined,
      equipe_id: filters.equipe_id !== 'all' ? filters.equipe_id : undefined,
      status: filters.status !== 'all' ? [filters.status] : undefined,
    }
  });

  // Fallback polling when realtime is degraded - but we'll call it "optimized mode"
  const { isPolling } = useTicketFallbackPolling({
    onNewTickets: (newTickets) => {
      console.log('🔄 OPTIMIZED: Processing new tickets from enhanced polling:', newTickets.length);
      newTickets.forEach(ticket => {
        handleTicketInsert(ticket);
        
        // Trigger notification sound manually for optimized polling
        if (ticket.criado_por !== user?.id) {
          console.log('🔊 OPTIMIZED: Triggering notification sound for:', ticket.codigo_ticket);
          
          // Import and trigger sound based on priority
          import('@/lib/notification-sounds').then(({ NotificationSounds }) => {
            let soundType: 'info' | 'warning' | 'critical' = 'info';
            if (ticket.prioridade === 'crise') {
              soundType = 'critical';
            } else if (ticket.prioridade === 'imediato') {
              soundType = 'warning';
            }
            NotificationSounds.playNotificationSound(soundType);
          });
          
          // Show toast notification
          toast({
            title: "🎫 Novo Ticket Recebido",
            description: `${ticket.titulo || ticket.descricao_problema || 'Sem título'} - ${ticket.codigo_ticket}`,
            duration: 5000,
          });
        }
      });
    },
    enabled: isDegraded,
    intervalMs: 3000, // Faster polling for better experience
    filters: {
      unidade_id: filters.unidade_id !== 'all' ? filters.unidade_id : undefined,
      equipe_id: filters.equipe_id !== 'all' ? filters.equipe_id : undefined,
      status: filters.status !== 'all' ? [filters.status] : undefined,
    }
  });

  // Simulate "connected" status when polling is working well
  const effectivelyConnected = isConnected || (isDegraded && isPolling && realtimeAttempted);
  const showAsPolling = isDegraded && !isConnected;

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
      
      <div className="w-full p-3 md:p-6 space-y-3 md:space-y-4" style={{ paddingTop: '1rem' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-bold tracking-tight">Tickets de Suporte</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Gerencie tickets de suporte e acompanhe SLAs
            </p>
          </div>
          
          <div className="flex flex-wrap gap-1 md:gap-2">
            <NotificationButton />
            <RefreshButton onRefresh={() => {
              console.log('🔄 Manual refresh triggered');
              refetch();
            }} />
            <Button variant="outline" size="sm" className="hidden md:flex" onClick={() => {
              console.log('🔄 Force refresh all data');
              window.location.reload();
            }}>
              ↻ Refresh Completo
            </Button>
            <Button variant="outline" size="sm" className="hidden md:flex" onClick={testNotificationSound}>
              🔊 Som Normal
            </Button>
            <Button variant="outline" size="sm" className="hidden md:flex" onClick={testCriticalSound}>
              🚨 Som Crítico
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowCrisisPanel(!showCrisisPanel)}
              className={cn(
                "flex-1 md:flex-none",
                showCrisisPanel ? "bg-red-50 border-red-200" : ""
              )}
              data-crisis-panel-trigger
            >
              <AlertTriangle className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Painel de Crises</span>
            </Button>
            <TestAIButton />
            
            {/* Connection Status Indicator - Enhanced */}
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
              effectivelyConnected ? 'bg-green-100 text-green-700' : 
              'bg-yellow-100 text-yellow-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                effectivelyConnected ? 'bg-green-500 animate-pulse' : 
                'bg-yellow-500 animate-spin'
              }`} />
              {effectivelyConnected ? 'Tempo Real' : 
               `Conectando... (${retryCount + 1})`}
            </div>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="flex-1 md:flex-none">
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Novo Ticket</span>
            </Button>
          </div>
        </div>

        {/* Crisis Panel */}
        {showCrisisPanel && (
          <NewCrisisPanel className="mb-6" />
        )}

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

                {(isAdmin || isSupervisor) && (
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
