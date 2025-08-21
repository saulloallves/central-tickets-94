import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Settings2, Database, Hash } from "lucide-react";
import { useNotificationSourceConfig, NotificationSourceConfig } from "@/hooks/useNotificationSourceConfig";

const NOTIFICATION_TYPES = [
  { value: 'resposta_ticket', label: 'Resposta do Ticket', description: 'Resposta enviada para grupos' },
  { value: 'resposta_ticket_franqueado', label: 'Resposta ao Franqueado', description: 'Resposta enviada ao franqueado' },
  { value: 'ticket_created', label: 'Ticket Criado', description: 'Quando um novo ticket é criado' },
  { value: 'crisis', label: 'Ativação de Crise', description: 'Quando uma crise é ativada' },
  { value: 'crisis_resolved', label: 'Crise Resolvida', description: 'Quando uma crise é resolvida' },
  { value: 'crisis_update', label: 'Atualização de Crise', description: 'Quando há ações na crise' },
  { value: 'sla_half', label: 'SLA 50%', description: 'Quando SLA atinge 50%' },
  { value: 'sla_breach', label: 'SLA Vencido', description: 'Quando SLA é ultrapassado' },
];

const AVAILABLE_TABLES = [
  { value: 'unidades', label: 'Unidades' },
  { value: 'franqueados', label: 'Franqueados' },
  { value: 'colaboradores', label: 'Colaboradores' },
];

const COMMON_COLUMNS = [
  { value: 'id_grupo_branco', label: 'ID Grupo Branco (unidades)' },
  { value: 'id_grupo_amarelo', label: 'ID Grupo Amarelo (unidades)' },
  { value: 'id_grupo_azul', label: 'ID Grupo Azul (unidades)' },
  { value: 'id_grupo_vermelho', label: 'ID Grupo Vermelho (unidades)' },
  { value: 'phone', label: 'Telefone (franqueados)' },
  { value: 'telefone', label: 'Telefone (colaboradores)' },
];

export function ConfiguracaoOrigemTab() {
  const { configs, loading, updateConfig } = useNotificationSourceConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<NotificationSourceConfig | null>(null);
  
  const [formData, setFormData] = useState({
    source_type: 'fixed' as 'column' | 'fixed' | 'dynamic',
    source_table: '',
    source_column: '',
    fixed_value: '',
    description: '',
    is_active: true
  });

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
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Configuração de Origem dos Números</h2>
        <p className="text-muted-foreground">
          Configure de onde vem os números para cada tipo de notificação
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurações por Tipo de Notificação
          </CardTitle>
          <CardDescription>
            Para cada tipo de notificação, defina se o número vem de uma coluna específica ou se é um valor fixo
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

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
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a tabela" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_TABLES.map((table) => (
                        <SelectItem key={table.value} value={table.value}>
                          {table.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="source_column">Coluna</Label>
                  <Select
                    value={formData.source_column}
                    onValueChange={(value) => setFormData({ ...formData, source_column: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_COLUMNS.map((column) => (
                        <SelectItem key={column.value} value={column.value}>
                          {column.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ou digite manualmente o nome da coluna
                  </p>
                  <Input
                    value={formData.source_column}
                    onChange={(e) => setFormData({ ...formData, source_column: e.target.value })}
                    placeholder="nome_da_coluna"
                  />
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