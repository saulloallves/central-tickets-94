import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Search, Filter } from 'lucide-react';
import { FranqueadoTicketsList } from '@/components/franqueado/FranqueadoTicketsList';
import { FranqueadoTicketDetail } from '@/components/franqueado/FranqueadoTicketDetail';
import { FranqueadoCreateTicketDialog } from '@/components/franqueado/FranqueadoCreateTicketDialog';
import { useFranqueadoUnits } from '@/hooks/useFranqueadoUnits';

import { supabase } from '@/integrations/supabase/client';

export default function FranqueadoTickets() {
  const { units, loading: unitsLoading } = useFranqueadoUnits();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [respondidosMap, setRespondidosMap] = useState<Record<string, boolean>>({});

  // Filtros
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    prioridade: '',
    unidade_id: '',
    categoria: '',
    status_sla: '',
    equipe_id: ''
  });

  // Update the displayed values for the select components
  const getSelectValue = (filterValue: string, defaultValue: string = "all") => {
    return filterValue === "" ? defaultValue : filterValue;
  };

  const [ticketStats, setTicketStats] = useState({ total: 0 });

  // Buscar estatísticas de tickets
  useEffect(() => {
    const fetchStats = async () => {
      if (units.length === 0) return;

      const unitIds = units.map(u => u.id);
      const { data } = await supabase
        .from('tickets')
        .select('id')
        .in('unidade_id', unitIds);

      setTicketStats({ total: data?.length || 0 });
    };

    fetchStats();
  }, [units]);

  // Real-time subscription for ticket stats
  useEffect(() => {
    if (units.length === 0) return;

    const unitIds = units.map(u => u.id);
    
    const channel = supabase
      .channel('franqueado-tickets-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `unidade_id=in.(${unitIds.join(',')})`
        },
        async () => {
          // Refetch stats when tickets change
          const { data } = await supabase
            .from('tickets')
            .select('id')
            .in('unidade_id', unitIds);

          setTicketStats({ total: data?.length || 0 });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [units]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      prioridade: '',
      unidade_id: '',
      categoria: '',
      status_sla: '',
      equipe_id: ''
    });
  };

  if (unitsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">
            Gerencie os tickets de suas unidades ({ticketStats?.total || 0} total)
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Ticket
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Código, descrição..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="unidade">Unidade</Label>
              <Select value={getSelectValue(filters.unidade_id)} onValueChange={(value) => handleFilterChange('unidade_id', value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.grupo} - {unit.cidade}/{unit.uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={getSelectValue(filters.status)} onValueChange={(value) => handleFilterChange('status', value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                  <SelectItem value="aguardando_cliente">Aguardando Cliente</SelectItem>
                  <SelectItem value="escalonado">Escalonado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select value={getSelectValue(filters.prioridade)} onValueChange={(value) => handleFilterChange('prioridade', value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as prioridades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as prioridades</SelectItem>
                  <SelectItem value="crise">Crise</SelectItem>
                  <SelectItem value="imediato">Imediato</SelectItem>
                  <SelectItem value="ate_1_hora">Até 1 hora</SelectItem>
                  <SelectItem value="ainda_hoje">Ainda hoje</SelectItem>
                  <SelectItem value="posso_esperar">Posso esperar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo Principal */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Lista de Tickets */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Lista de Tickets</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <FranqueadoTicketsList
                filters={filters}
                onTicketSelect={setSelectedTicketId}
                selectedTicketId={selectedTicketId}
              />
            </div>
          </CardContent>
        </Card>

        {/* Detalhes do Ticket */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>
              {selectedTicketId ? 'Detalhes do Ticket' : 'Selecione um ticket'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {selectedTicketId ? (
              <div className="h-full overflow-y-auto">
                <FranqueadoTicketDetail 
                  ticketId={selectedTicketId} 
                  onClose={() => setSelectedTicketId(null)}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Clique em um ticket para ver os detalhes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Criação */}
      <FranqueadoCreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}