import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Settings2, Database, Hash, Loader2 } from "lucide-react";
import { useNotificationSourceConfig, NotificationSourceConfig } from "@/hooks/useNotificationSourceConfig";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const NOTIFICATION_TYPES = [
  { value: 'resposta_ticket', label: 'Resposta do Ticket', description: 'Resposta enviada para grupos' },
  { value: 'resposta_ticket_franqueado', label: 'Resposta ao Franqueado', description: 'Resposta enviada ao franqueado' },
  { value: 'ticket_created', label: 'Ticket Criado', description: 'Quando um novo ticket é criado' },
  { value: 'sla_breach', label: 'SLA Vencido', description: 'Quando um ticket ultrapassa o prazo' },
  { value: 'sla_half', label: 'SLA 50%', description: 'Quando SLA atinge 50%' },
];

export function ConfiguracaoOrigemTab() {
  const { configs, loading, updateConfig } = useNotificationSourceConfig();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<NotificationSourceConfig | null>(null);
  const [availableTables, setAvailableTables] = useState<{ value: string; label: string }[]>([]);
  const [tableColumns, setTableColumns] = useState<{ value: string; label: string }[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  
  const [formData, setFormData] = useState({
    source_type: 'fixed' as 'column' | 'fixed' | 'dynamic',
    source_table: '',
    source_column: '',
    fixed_value: '',
    description: '',
    is_active: true
  });

  // Buscar tabelas disponíveis do Supabase
  useEffect(() => {
    fetchAvailableTables();
  }, []);

  // Buscar colunas quando a tabela é selecionada
  useEffect(() => {
    if (formData.source_table) {
      fetchTableColumns(formData.source_table);
    } else {
      setTableColumns([]);
    }
  }, [formData.source_table]);

  const fetchAvailableTables = async () => {
    setLoadingTables(true);
    try {
      // Lista de tabelas principais do sistema
      // Como não podemos consultar o schema diretamente, usamos uma lista conhecida
      const knownTables = [
        'unidades',
        'unidades_whatsapp',
        'franqueados', 
        'colaboradores',
        'tickets',
        'equipes',
        'atendentes',
        'ticket_mensagens',
        'notifications_queue',
      ];

      // Verificar quais tabelas realmente existem tentando fazer uma query
      const tableChecks = await Promise.all(
        knownTables.map(async (tableName) => {
          try {
            const { error } = await (supabase as any)
              .from(tableName)
              .select('*')
              .limit(0);
            
            return error ? null : {
              value: tableName,
              label: tableName.charAt(0).toUpperCase() + tableName.slice(1).replace(/_/g, ' '),
            };
          } catch {
            return null;
          }
        })
      );

      const validTables = tableChecks.filter(Boolean) as { value: string; label: string }[];
      setAvailableTables(validTables.length > 0 ? validTables : [
        { value: 'unidades', label: 'Unidades' },
        { value: 'franqueados', label: 'Franqueados' },
        { value: 'colaboradores', label: 'Colaboradores' },
      ]);
    } catch (error) {
      console.error('Erro ao buscar tabelas:', error);
      // Fallback para tabelas conhecidas
      setAvailableTables([
        { value: 'unidades', label: 'Unidades' },
        { value: 'franqueados', label: 'Franqueados' },
        { value: 'colaboradores', label: 'Colaboradores' },
      ]);
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchTableColumns = async (tableName: string) => {
    setLoadingColumns(true);
    try {
      // Buscar uma linha da tabela para obter as colunas
      const { data, error } = await (supabase as any)
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        console.error('Erro ao buscar colunas:', error);
        toast({
          title: "Erro ao buscar colunas",
          description: `Não foi possível buscar as colunas da tabela ${tableName}`,
          variant: "destructive",
        });
        setTableColumns([]);
        return;
      }

      if (data && data.length > 0) {
        const columns = Object.keys(data[0]).map(columnName => ({
          value: columnName,
          label: columnName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
        }));
        setTableColumns(columns);
      } else {
        setTableColumns([]);
      }
    } catch (error) {
      console.error('Erro ao buscar colunas:', error);
      setTableColumns([]);
    } finally {
      setLoadingColumns(false);
    }
  };

  const openEditDialog = (config: NotificationSourceConfig) => {
    setFormData({
      source_type: config.source_type,
      source_table: config.source_table || '',
      source_column: config.source_column || '',
      fixed_value: config.fixed_value || '',
      description: config.description || '',
      is_active: config.is_active
    });
    setEditingConfig(config);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingConfig) return;

    const configData = {
      ...formData,
      source_table: formData.source_type === 'column' ? formData.source_table : null,
      source_column: formData.source_type === 'column' ? formData.source_column : null,
      fixed_value: formData.source_type === 'fixed' ? formData.fixed_value : null,
    };

    await updateConfig(editingConfig.id, configData);
    setDialogOpen(false);
  };

  const getTypeLabel = (type: string) => {
    const notificationType = NOTIFICATION_TYPES.find(nt => nt.value === type);
    return notificationType ? notificationType.label : type;
  };

  const getSourceDescription = (config: NotificationSourceConfig) => {
    switch (config.source_type) {
      case 'column':
        return `Da tabela ${config.source_table}.${config.source_column}`;
      case 'fixed':
        return config.fixed_value || 'Valor fixo não configurado';
      case 'dynamic':
        return 'Configuração dinâmica';
      default:
        return 'Não configurado';
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {configs.map((config) => (
          <div
            key={config.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={config.is_active ? "default" : "secondary"}>
                  {getTypeLabel(config.notification_type)}
                </Badge>
                {!config.is_active && (
                  <Badge variant="outline" className="text-xs">
                    Inativo
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {config.source_type === 'column' ? (
                    <Database className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Hash className="h-4 w-4 text-green-600" />
                  )}
                  <span className="font-medium text-sm">
                    {config.source_type === 'column' ? 'Da Coluna:' : 'Valor Fixo:'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {getSourceDescription(config)}
                  </span>
                </div>
                {config.description && (
                  <p className="text-xs text-muted-foreground">
                    {config.description}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDialog(config)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Editar Configuração de Origem
            </DialogTitle>
            <DialogDescription>
              Configure de onde vem o número para {editingConfig && getTypeLabel(editingConfig.notification_type)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source_type">Tipo de Origem</Label>
              <Select
                value={formData.source_type}
                onValueChange={(value: 'column' | 'fixed' | 'dynamic') => 
                  setFormData({ ...formData, source_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="column">Da Coluna (Buscar de uma tabela)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (Número específico)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.source_type === 'column' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="source_table">Tabela</Label>
                  <Select
                    value={formData.source_table}
                    onValueChange={(value) => setFormData({ ...formData, source_table: value })}
                    disabled={loadingTables}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingTables ? "Carregando tabelas..." : "Selecione a tabela"} />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {loadingTables ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        availableTables.map((table) => (
                          <SelectItem key={table.value} value={table.value}>
                            {table.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source_column">Coluna</Label>
                  <Select
                    value={formData.source_column}
                    onValueChange={(value) => setFormData({ ...formData, source_column: value })}
                    disabled={!formData.source_table || loadingColumns}
                  >
                    <SelectTrigger>
                      <SelectValue 
                        placeholder={
                          !formData.source_table 
                            ? "Primeiro selecione uma tabela" 
                            : loadingColumns 
                            ? "Carregando colunas..." 
                            : "Selecione a coluna"
                        } 
                      />
                    </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                      {loadingColumns ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : tableColumns.length > 0 ? (
                        tableColumns.map((column) => (
                          <SelectItem key={column.value} value={column.value}>
                            {column.label}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-4 space-y-2">
                          <p className="text-sm text-muted-foreground">
                            Tabela vazia - não foi possível detectar colunas
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Digite manualmente o nome da coluna abaixo
                          </p>
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">
                      Digite o nome da coluna:
                    </p>
                    <Input
                      value={formData.source_column}
                      onChange={(e) => setFormData({ ...formData, source_column: e.target.value })}
                      placeholder="Ex: id_grupo_whatsapp"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 Dica: Se a tabela tiver dados, as colunas serão detectadas automaticamente
                    </p>
                  </div>
                </div>
              </>
            )}

            {formData.source_type === 'fixed' && (
              <div className="space-y-2">
                <Label htmlFor="fixed_value">Número Fixo</Label>
                <Input
                  id="fixed_value"
                  value={formData.fixed_value}
                  onChange={(e) => setFormData({ ...formData, fixed_value: e.target.value })}
                  placeholder="5511999999999 ou ID do grupo"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Configuração ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}