import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useSystemLogs, LogFilters } from '@/hooks/useSystemLogs';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, Search, Filter, Eye, Activity, AlertTriangle, User, Bot } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const LogsPage = () => {
  const { logs, loading, fetchLogs, exportLogs } = useSystemLogs();
  const [filters, setFilters] = useState<LogFilters>({});
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleFilterChange = (key: keyof LogFilters, value: string) => {
    // Convert "all" back to undefined for the API call
    const filterValue = value === "all" ? undefined : value;
    const newFilters = { ...filters, [key]: filterValue };
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  const getLogTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'acao_humana': return <User className="h-4 w-4" />;
      case 'acao_ia': return <Bot className="h-4 w-4" />;
      case 'sistema': return <Activity className="h-4 w-4" />;
      case 'erro': return <AlertTriangle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getLogTypeBadge = (tipo: string) => {
    switch (tipo) {
      case 'acao_humana': return <Badge variant="default" className="bg-blue-100 text-blue-800">Ação Humana</Badge>;
      case 'acao_ia': return <Badge variant="default" className="bg-purple-100 text-purple-800">Ação IA</Badge>;
      case 'sistema': return <Badge variant="default" className="bg-green-100 text-green-800">Sistema</Badge>;
      case 'erro': return <Badge variant="destructive">Erro</Badge>;
      case 'escalonamento': return <Badge variant="default" className="bg-orange-100 text-orange-800">Escalonamento</Badge>;
      case 'seguranca': return <Badge variant="destructive">Segurança</Badge>;
      default: return <Badge variant="secondary">{tipo}</Badge>;
    }
  };

  const formatLogData = (data: any) => {
    if (!data) return 'N/A';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="w-full space-y-4 md:space-y-6 pt-3 md:pt-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tight">Logs do Sistema</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Auditoria completa de todas as ações realizadas no sistema
          </p>
        </div>
        <Button onClick={() => exportLogs(filters)} className="gap-2 w-full md:w-auto">
          <Download className="h-4 w-4" />
          <span className="hidden md:inline">Exportar Logs</span>
          <span className="md:hidden">Exportar</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div>
            <label className="text-xs md:text-sm font-medium mb-1 md:mb-2 block">Tipo de Log</label>
            <Select onValueChange={(value) => handleFilterChange('tipo_log', value)}>
              <SelectTrigger className="text-xs md:text-sm">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="acao_humana">Ação Humana</SelectItem>
                <SelectItem value="acao_ia">Ação IA</SelectItem>
                <SelectItem value="sistema">Sistema</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
                <SelectItem value="escalonamento">Escalonamento</SelectItem>
                <SelectItem value="seguranca">Segurança</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs md:text-sm font-medium mb-1 md:mb-2 block">Entidade</label>
            <Select onValueChange={(value) => handleFilterChange('entidade_afetada', value)}>
              <SelectTrigger className="text-xs md:text-sm">
                <SelectValue placeholder="Todas as entidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="tickets">Tickets</SelectItem>
                <SelectItem value="ticket_mensagens">Mensagens</SelectItem>
                <SelectItem value="colaboradores">Colaboradores</SelectItem>
                <SelectItem value="equipes">Equipes</SelectItem>
                <SelectItem value="configuracao">Configuração</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs md:text-sm font-medium mb-1 md:mb-2 block">Data Início</label>
            <Input
              type="date"
              className="text-xs md:text-sm"
              onChange={(e) => handleFilterChange('data_inicio', e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs md:text-sm font-medium mb-1 md:mb-2 block">Data Fim</label>
            <Input
              type="date"
              className="text-xs md:text-sm"
              onChange={(e) => handleFilterChange('data_fim', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Logs do Sistema ({logs.length})
          </CardTitle>
          <CardDescription>
            Todas as ações registradas no sistema em ordem cronológica
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log encontrado com os filtros aplicados
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="border rounded-lg p-3 md:p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">
                        {getLogTypeIcon(log.tipo_log)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 md:gap-2 mb-1">
                          {getLogTypeBadge(log.tipo_log)}
                          <span className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                            {log.entidade_afetada}
                          </span>
                          {log.ia_modelo && (
                            <Badge variant="outline" className="text-[9px] md:text-xs px-1 py-0.5">
                              {log.ia_modelo}
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-xs md:text-sm line-clamp-2">{log.acao_realizada}</p>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1 md:mt-2 text-[10px] md:text-xs text-muted-foreground">
                          <span>ID: {log.entidade_id.slice(0, 6)}...</span>
                          <span className="line-clamp-1">
                            {formatDistanceToNow(new Date(log.timestamp), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                          {log.canal && <span className="hidden md:inline">Canal: {log.canal}</span>}
                        </div>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="h-6 w-6 md:h-8 md:w-8 p-0">
                          <Eye className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[95vw] max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Detalhes do Log</DialogTitle>
                          <DialogDescription>
                            Informações completas sobre a ação registrada
                          </DialogDescription>
                        </DialogHeader>
                        
                        {selectedLog && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium">Tipo</label>
                                <div>{getLogTypeBadge(selectedLog.tipo_log)}</div>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Timestamp</label>
                                <p className="text-sm">{new Date(selectedLog.timestamp).toLocaleString('pt-BR')}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Entidade</label>
                                <p className="text-sm">{selectedLog.entidade_afetada}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium">ID da Entidade</label>
                                <p className="text-sm font-mono">{selectedLog.entidade_id}</p>
                              </div>
                            </div>

                            <Separator />

                            <div>
                              <label className="text-sm font-medium">Ação Realizada</label>
                              <p className="text-sm mt-1">{selectedLog.acao_realizada}</p>
                            </div>

                            {selectedLog.ia_modelo && (
                              <>
                                <Separator />
                                <div>
                                  <label className="text-sm font-medium">Modelo IA</label>
                                  <p className="text-sm mt-1">{selectedLog.ia_modelo}</p>
                                </div>
                              </>
                            )}

                            {selectedLog.prompt_entrada && (
                              <>
                                <Separator />
                                <div>
                                  <label className="text-sm font-medium">Prompt de Entrada</label>
                                  <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-x-auto">
                                    {selectedLog.prompt_entrada}
                                  </pre>
                                </div>
                              </>
                            )}

                            {selectedLog.resposta_gerada && (
                              <>
                                <Separator />
                                <div>
                                  <label className="text-sm font-medium">Resposta Gerada</label>
                                  <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-x-auto">
                                    {selectedLog.resposta_gerada}
                                  </pre>
                                </div>
                              </>
                            )}

                            <Tabs defaultValue="before" className="w-full">
                              <TabsList>
                                <TabsTrigger value="before">Dados Anteriores</TabsTrigger>
                                <TabsTrigger value="after">Dados Novos</TabsTrigger>
                              </TabsList>
                              <TabsContent value="before">
                                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                                  {formatLogData(selectedLog.dados_anteriores)}
                                </pre>
                              </TabsContent>
                              <TabsContent value="after">
                                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                                  {formatLogData(selectedLog.dados_novos)}
                                </pre>
                              </TabsContent>
                            </Tabs>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LogsPage;