import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Download, 
  Filter, 
  Clock, 
  User, 
  Activity,
  RefreshCw,
  Eye,
  Calendar
} from "lucide-react";
import { useSystemLogs } from "@/hooks/useSystemLogs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function AuditPanel() {
  const { logs, loading, fetchLogs, exportLogs } = useSystemLogs();
  const [filters, setFilters] = useState({
    tipo_log: 'all',
    entidade_afetada: 'all',
    usuario_responsavel: '',
    data_inicio: '',
    data_fim: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value === 'all' ? '' : value };
    setFilters({ ...filters, [key]: value });
    fetchLogs(newFilters);
  };

  const handleSearch = () => {
    fetchLogs(filters);
  };

  const handleExport = () => {
    exportLogs(filters);
  };

  // Filter logs by search term
  const filteredLogs = logs.filter(log => 
    log.acao_realizada.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entidade_afetada.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.entidade_id && log.entidade_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getActionBadgeVariant = (tipoLog: string) => {
    switch (tipoLog) {
      case 'acao_humana':
        return 'default';
      case 'sistema':
        return 'secondary';
      case 'ia_interacao':
        return 'outline';
      case 'erro':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getEntityIcon = (entidade: string) => {
    switch (entidade) {
      case 'tickets':
        return '🎫';
      case 'usuarios':
        return '👤';
      case 'configuracoes':
        return '⚙️';
      case 'crises':
        return '🚨';
      default:
        return '📄';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Auditoria de Ações</h2>
          <p className="text-muted-foreground">Histórico completo de ações no sistema</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleExport}
            className="liquid-glass-button"
            disabled={loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            onClick={() => fetchLogs(filters)}
            disabled={loading}
            className="liquid-glass-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="liquid-glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Log</label>
              <Select 
                value={filters.tipo_log} 
                onValueChange={(value) => handleFilterChange('tipo_log', value)}
              >
                <SelectTrigger className="liquid-glass-input">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="acao_humana">Ação Humana</SelectItem>
                  <SelectItem value="sistema">Sistema</SelectItem>
                  <SelectItem value="ia_interacao">IA Interação</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Entidade</label>
              <Select 
                value={filters.entidade_afetada} 
                onValueChange={(value) => handleFilterChange('entidade_afetada', value)}
              >
                <SelectTrigger className="liquid-glass-input">
                  <SelectValue placeholder="Todas as entidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as entidades</SelectItem>
                  <SelectItem value="tickets">Tickets</SelectItem>
                  <SelectItem value="usuarios">Usuários</SelectItem>
                  <SelectItem value="configuracoes">Configurações</SelectItem>
                  <SelectItem value="crises">Crises</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Início</label>
              <Input
                type="date"
                value={filters.data_inicio}
                onChange={(e) => handleFilterChange('data_inicio', e.target.value)}
                className="liquid-glass-input"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Fim</label>
              <Input
                type="date"
                value={filters.data_fim}
                onChange={(e) => handleFilterChange('data_fim', e.target.value)}
                className="liquid-glass-input"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ação, entidade ou ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 liquid-glass-input"
              />
            </div>
            <Button onClick={handleSearch} className="liquid-glass-button">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card className="liquid-glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Registro de Ações</span>
          </CardTitle>
          <CardDescription>
            {filteredLogs.length} registro(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Nenhum log encontrado com os filtros aplicados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.tipo_log)}>
                          {log.tipo_log}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{log.acao_realizada}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getEntityIcon(log.entidade_afetada)}</span>
                          <div>
                            <p className="text-sm font-medium">{log.entidade_afetada}</p>
                            {log.entidade_id && (
                              <p className="text-xs text-muted-foreground">ID: {log.entidade_id}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {log.usuario_responsavel || 'Sistema'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {log.canal || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-2">
                                {log.dados_anteriores && (
                                  <div>
                                    <p className="font-semibold">Dados Anteriores:</p>
                                    <pre className="text-xs">{JSON.stringify(log.dados_anteriores, null, 2)}</pre>
                                  </div>
                                )}
                                {log.dados_novos && (
                                  <div>
                                    <p className="font-semibold">Dados Novos:</p>
                                    <pre className="text-xs">{JSON.stringify(log.dados_novos, null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}