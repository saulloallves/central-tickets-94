
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSystemLogs } from '@/hooks/useSystemLogs';
import { Search, Filter, Calendar, User, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const AuditPanel = () => {
  const { logs, loading, fetchLogs } = useSystemLogs();
  const [filters, setFilters] = useState({
    tipo_log: '',
    entidade_afetada: '',
    usuario_responsavel: '',
    data_inicio: '',
    data_fim: '',
    search: ''
  });

  const [filteredLogs, setFilteredLogs] = useState(logs);

  useEffect(() => {
    fetchLogs({}, 200);
  }, []);

  useEffect(() => {
    let filtered = [...logs];

    if (filters.search) {
      filtered = filtered.filter(log => 
        log.acao_realizada.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.entidade_afetada.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.tipo_log) {
      filtered = filtered.filter(log => log.tipo_log === filters.tipo_log);
    }

    if (filters.entidade_afetada) {
      filtered = filtered.filter(log => log.entidade_afetada === filters.entidade_afetada);
    }

    setFilteredLogs(filtered);
  }, [logs, filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      tipo_log: '',
      entidade_afetada: '',
      usuario_responsavel: '',
      data_inicio: '',
      data_fim: '',
      search: ''
    });
  };

  const getLogTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'acao_humana': return 'bg-blue-500';
      case 'acao_ia': return 'bg-purple-500';
      case 'sistema': return 'bg-green-500';
      case 'erro': return 'bg-red-500';
      case 'escalonamento': return 'bg-orange-500';
      case 'seguranca': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getLogTypeLabel = (tipo: string) => {
    switch (tipo) {
      case 'acao_humana': return 'Ação Humana';
      case 'acao_ia': return 'IA';
      case 'sistema': return 'Sistema';
      case 'erro': return 'Erro';
      case 'escalonamento': return 'Escalação';
      case 'seguranca': return 'Segurança';
      default: return tipo;
    }
  };

  const uniqueEntidades = [...new Set(logs.map(log => log.entidade_afetada))];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Auditoria de Ações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ações..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filters.tipo_log} onValueChange={(value) => handleFilterChange('tipo_log', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Log" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os tipos</SelectItem>
                <SelectItem value="acao_humana">Ação Humana</SelectItem>
                <SelectItem value="acao_ia">IA</SelectItem>
                <SelectItem value="sistema">Sistema</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
                <SelectItem value="escalonamento">Escalação</SelectItem>
                <SelectItem value="seguranca">Segurança</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.entidade_afetada} onValueChange={(value) => handleFilterChange('entidade_afetada', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as entidades</SelectItem>
                {uniqueEntidades.map(entidade => (
                  <SelectItem key={entidade} value={entidade}>
                    {entidade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={clearFilters} variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Limpar Filtros
            </Button>
          </div>

          {/* Lista de Logs */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">Carregando logs...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum log encontrado</p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <Card key={log.id} className="border-l-4" style={{ borderLeftColor: getLogTypeColor(log.tipo_log).replace('bg-', '#') }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              className={`${getLogTypeColor(log.tipo_log)} text-white text-xs`}
                            >
                              {getLogTypeLabel(log.tipo_log)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {log.entidade_afetada}
                            </Badge>
                            {log.canal && (
                              <Badge variant="secondary" className="text-xs">
                                {log.canal}
                              </Badge>
                            )}
                          </div>
                          
                          <h4 className="font-medium mb-1">{log.acao_realizada}</h4>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.usuario_responsavel ? 'Usuário' : 'Sistema'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(log.timestamp), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                            {log.entidade_id && (
                              <span className="text-xs font-mono">
                                ID: {log.entidade_id.substring(0, 8)}...
                              </span>
                            )}
                          </div>

                          {/* Detalhes específicos para IA */}
                          {log.tipo_log === 'acao_ia' && log.ia_modelo && (
                            <div className="mt-2 p-2 bg-purple-50 rounded text-xs">
                              <span className="font-medium">Modelo:</span> {log.ia_modelo}
                              {log.prompt_entrada && (
                                <div className="mt-1">
                                  <span className="font-medium">Prompt:</span> {log.prompt_entrada.substring(0, 100)}...
                                </div>
                              )}
                            </div>
                          )}

                          {/* Detalhes de mudanças */}
                          {(log.dados_anteriores || log.dados_novos) && (
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                              {log.dados_anteriores && (
                                <div className="p-2 bg-red-50 rounded text-xs">
                                  <span className="font-medium text-red-700">Antes:</span>
                                  <pre className="mt-1 text-red-600 whitespace-pre-wrap">
                                    {JSON.stringify(log.dados_anteriores, null, 2).substring(0, 200)}...
                                  </pre>
                                </div>
                              )}
                              {log.dados_novos && (
                                <div className="p-2 bg-green-50 rounded text-xs">
                                  <span className="font-medium text-green-700">Depois:</span>
                                  <pre className="mt-1 text-green-600 whitespace-pre-wrap">
                                    {JSON.stringify(log.dados_novos, null, 2).substring(0, 200)}...
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
