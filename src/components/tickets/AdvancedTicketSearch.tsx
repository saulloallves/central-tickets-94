import { useState } from 'react';
import { format } from 'date-fns';
import { Search, CalendarIcon, Download, X, Eye, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdvancedTicketSearch } from '@/hooks/useAdvancedTicketSearch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AdvancedTicketSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketSelect: (ticketId: string) => void;
}

export function AdvancedTicketSearch({ open, onOpenChange, onTicketSelect }: AdvancedTicketSearchProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    search: '',
    dataInicio: undefined as Date | undefined,
    dataFim: undefined as Date | undefined,
    unidade_id: 'all',
    status: 'all',
    prioridade: 'all',
    status_sla: 'all',
    categoria: 'all'
  });

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { tickets, totalCount, loading, unidades } = useAdvancedTicketSearch(filters, page, pageSize, open);

  const handleClearFilters = () => {
    setFilters({
      search: '',
      dataInicio: undefined,
      dataFim: undefined,
      unidade_id: 'all',
      status: 'all',
      prioridade: 'all',
      status_sla: 'all',
      categoria: 'all'
    });
    setPage(1);
  };

  const handleExportCSV = () => {
    const headers = [
      'Código',
      'Data Abertura',
      'Unidade',
      'Franqueado',
      'Título',
      'Descrição',
      'Status',
      'Prioridade',
      'SLA Status',
      'Equipe',
      'Categoria'
    ];

    const rows = tickets.map(t => [
      t.codigo_ticket,
      format(new Date(t.data_abertura), 'dd/MM/yyyy HH:mm'),
      t.unidades?.grupo || '',
      t.unidades?.codigo_grupo || '',
      t.titulo || '',
      t.descricao_problema || '',
      t.status || '',
      t.prioridade || '',
      t.status_sla || '',
      t.equipes?.nome || '',
      t.categoria || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tickets_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    link.click();
  };

  const getStatusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'aberto': 'default',
      'em_atendimento': 'secondary',
      'concluido': 'outline',
      'cancelado': 'destructive'
    };
    return variants[status] || 'default';
  };

  const getPriorityVariant = (prioridade: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'crise': 'destructive',
      'imediato': 'destructive',
      'alto': 'default',
      'medio': 'secondary',
      'baixo': 'outline'
    };
    return variants[prioridade] || 'default';
  };

  const getSLAVariant = (status_sla: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'vencido': 'destructive',
      'alerta': 'default',
      'dentro_prazo': 'secondary'
    };
    return variants[status_sla] || 'outline';
  };

  // Helper functions para labels formatados
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'aberto': 'Aberto',
      'em_atendimento': 'Em Atendimento',
      'escalonado': 'Escalonado',
      'concluido': 'Concluído'
    };
    return labels[status] || status;
  };

  const getPrioridadeLabel = (prioridade: string) => {
    const labels: Record<string, string> = {
      'baixo': 'Baixo',
      'medio': 'Médio',
      'alto': 'Alto',
      'imediato': 'Imediato',
      'crise': 'CRISE'
    };
    return labels[prioridade] || prioridade;
  };

  const getSLALabel = (sla: string) => {
    const labels: Record<string, string> = {
      'dentro_prazo': 'Dentro do Prazo',
      'alerta': 'Alerta',
      'vencido': 'Vencido'
    };
    return labels[sla] || sla;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Consulta Avançada de Tickets
          </DialogTitle>
          <DialogDescription className="sr-only">
            Pesquise e filtre tickets com múltiplos critérios combinados
          </DialogDescription>
        </DialogHeader>

        {/* Painel de Filtros */}
        <div className="px-6 py-4 bg-muted/30 border-b space-y-4">
          {/* Linha 1: Busca e Datas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input 
              placeholder="Buscar código, título, descrição..." 
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
            
            {/* Date Picker - Data Início */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!filters.dataInicio && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataInicio ? format(filters.dataInicio, 'dd/MM/yyyy') : 'Data Início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single"
                  selected={filters.dataInicio}
                  onSelect={date => setFilters(prev => ({ ...prev, dataInicio: date }))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Date Picker - Data Fim */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn(!filters.dataFim && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataFim ? format(filters.dataFim, 'dd/MM/yyyy') : 'Data Fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single"
                  selected={filters.dataFim}
                  onSelect={date => setFilters(prev => ({ ...prev, dataFim: date }))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Linha 2: Selects de Filtros */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Select Unidade */}
            <Select value={filters.unidade_id} onValueChange={value => setFilters(prev => ({ ...prev, unidade_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Unidades</SelectItem>
                {unidades.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.grupo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Select Status */}
            <Select value={filters.status} onValueChange={value => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                <SelectItem value="escalonado">Escalonado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>

            {/* Select Prioridade */}
            <Select value={filters.prioridade} onValueChange={value => setFilters(prev => ({ ...prev, prioridade: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Prioridades</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="imediato">Imediato</SelectItem>
                <SelectItem value="crise">CRISE</SelectItem>
              </SelectContent>
            </Select>

            {/* Select SLA */}
            <Select value={filters.status_sla} onValueChange={value => setFilters(prev => ({ ...prev, status_sla: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="SLA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos SLA</SelectItem>
                <SelectItem value="dentro_prazo">Dentro do Prazo</SelectItem>
                <SelectItem value="alerta">Alerta (50%)</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>

            {/* Select Categoria */}
            <Select value={filters.categoria} onValueChange={value => setFilters(prev => ({ ...prev, categoria: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                <SelectItem value="juridico">Jurídico</SelectItem>
                <SelectItem value="sistema">Sistema</SelectItem>
                <SelectItem value="midia">Mídia</SelectItem>
                <SelectItem value="operacoes">Operações</SelectItem>
                <SelectItem value="rh">RH</SelectItem>
                <SelectItem value="financeiro">Financeiro</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleClearFilters} size="sm">
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            
            <div className="flex gap-2 items-center">
              <Badge variant="secondary">
                {totalCount} {totalCount === 1 ? 'ticket encontrado' : 'tickets encontrados'}
              </Badge>
              <Button variant="outline" onClick={handleExportCSV} size="sm" disabled={tickets.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Tabela de Resultados */}
        <ScrollArea className="flex-1 px-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Filter className="h-8 w-8 animate-pulse mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Buscando tickets...</p>
              </div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Search className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Nenhum ticket encontrado</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Data Abertura</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Código Grupo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map(ticket => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-sm">{ticket.codigo_ticket}</TableCell>
                    <TableCell className="text-sm">{format(new Date(ticket.data_abertura), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell className="text-sm">{ticket.unidades?.grupo || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{ticket.unidades?.codigo_grupo || ticket.codigo_ticket?.split('-')[0] || 'N/A'}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{ticket.titulo}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(ticket.status)}>
                        {getStatusLabel(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityVariant(ticket.prioridade)}>
                        {getPrioridadeLabel(ticket.prioridade)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSLAVariant(ticket.status_sla || 'dentro_prazo')}>
                        {getSLALabel(ticket.status_sla || 'dentro_prazo')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{ticket.equipes?.nome || 'Não atribuído'}</TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          toast({
                            title: "Abrindo ticket",
                            description: `Ticket ${ticket.codigo_ticket}`,
                          });
                          onTicketSelect(ticket.id);
                          onOpenChange(false);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
