
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Send, AlertTriangle, Settings } from "lucide-react";
import { useNotificationRoutes, NotificationRoute } from "@/hooks/useNotificationRoutes";

const NOTIFICATION_TYPES = [
  { value: 'crisis', label: 'Ativação de Crise', description: 'Quando uma crise é ativada' },
  { value: 'crisis_resolved', label: 'Crise Resolvida', description: 'Quando uma crise é resolvida' },
  { value: 'crisis_update', label: 'Atualização de Crise', description: 'Quando há ações na crise' },
  { value: 'ticket_created', label: 'Ticket Criado', description: 'Quando um novo ticket é criado' },
  { value: 'resposta_ticket', label: 'Resposta do Ticket', description: 'Respostas enviadas aos grupos' },
  { value: 'resposta_ticket_franqueado', label: 'Resposta ao Franqueado', description: 'Respostas enviadas ao franqueado' },
  { value: 'sla_half', label: 'SLA 50%', description: 'Quando SLA atinge 50%' },
  { value: 'sla_breach', label: 'SLA Vencido', description: 'Quando SLA é ultrapassado' },
];

export function RotasEnvioTab() {
  const { routes, loading, saveRoute, updateRoute, deleteRoute } = useNotificationRoutes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<NotificationRoute | null>(null);
  
  const [formData, setFormData] = useState({
    type: '',
    destination_value: '',
    destination_label: '',
    description: '',
    unit_id: '',
    priority: 0,
    is_active: true
  });

  const resetForm = () => {
    setFormData({
      type: '',
      destination_value: '',
      destination_label: '',
      description: '',
      unit_id: '',
      priority: 0,
      is_active: true
    });
    setEditingRoute(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (route: NotificationRoute) => {
    setFormData({
      type: route.type,
      destination_value: route.destination_value,
      destination_label: route.destination_label || '',
      description: route.description || '',
      unit_id: route.unit_id || '',
      priority: route.priority,
      is_active: route.is_active
    });
    setEditingRoute(route);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.type || !formData.destination_value) {
      return;
    }

    const routeData = {
      ...formData,
      unit_id: formData.unit_id || null,
      destination_label: formData.destination_label || null,
      description: formData.description || null,
    };

    if (editingRoute) {
      await updateRoute(editingRoute.id, routeData);
    } else {
      await saveRoute(routeData);
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (route: NotificationRoute) => {
    if (window.confirm(`Tem certeza que deseja remover a rota "${route.destination_label || route.type}"?`)) {
      await deleteRoute(route.id);
    }
  };

  const getTypeLabel = (type: string) => {
    const notificationType = NOTIFICATION_TYPES.find(nt => nt.value === type);
    return notificationType ? notificationType.label : type;
  };

  const formatPhoneForDisplay = (phone: string) => {
    if (!phone) return phone;
    // Mascarar parte do número para segurança
    if (phone.length > 8) {
      return phone.substring(0, 4) + '***' + phone.substring(phone.length - 4);
    }
    return phone;
  };

  const groupedRoutes = routes.reduce((acc, route) => {
    const key = route.unit_id || 'global';
    if (!acc[key]) acc[key] = [];
    acc[key].push(route);
    return acc;
  }, {} as Record<string, NotificationRoute[]>);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Rotas de Envio</h2>
        <p className="text-muted-foreground">
          Configure para onde cada tipo de notificação será enviada
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Rotas Configuradas</h3>
          <p className="text-sm text-muted-foreground">
            {routes.length} rotas configuradas
          </p>
        </div>
        <Button onClick={openCreateDialog} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Rota
        </Button>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedRoutes).map(([unitKey, unitRoutes]) => (
          <Card key={unitKey}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {unitKey === 'global' ? 'Rotas Globais' : `Unidade: ${unitKey}`}
              </CardTitle>
              <CardDescription>
                {unitKey === 'global' 
                  ? 'Aplicadas a todas as unidades quando não há rota específica'
                  : `Rotas específicas para a unidade ${unitKey}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {unitRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={route.is_active ? "default" : "secondary"}>
                          {getTypeLabel(route.type)}
                        </Badge>
                        {!route.is_active && (
                          <Badge variant="outline" className="text-xs">
                            Inativo
                          </Badge>
                        )}
                        {route.priority > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Prioridade: {route.priority}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <Send className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">
                            {route.destination_label || 'Sem nome'}
                          </span>
                          <span className="text-muted-foreground font-mono">
                            {formatPhoneForDisplay(route.destination_value)}
                          </span>
                        </div>
                        {route.description && (
                          <p className="text-muted-foreground text-xs">
                            {route.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(route)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(route)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {unitRoutes.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    Nenhuma rota configurada para esta categoria
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {routes.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma rota configurada</h3>
              <p className="text-muted-foreground mb-4">
                Configure rotas para definir onde as notificações serão enviadas
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira rota
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRoute ? 'Editar Rota' : 'Nova Rota de Notificação'}
            </DialogTitle>
            <DialogDescription>
              Configure para onde este tipo de notificação será enviada
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Notificação</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination_value">Número/ID do Destino</Label>
              <Input
                id="destination_value"
                value={formData.destination_value}
                onChange={(e) => setFormData({ ...formData, destination_value: e.target.value })}
                placeholder="5511999999999 ou ID do grupo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination_label">Nome do Destino</Label>
              <Input
                id="destination_label"
                value={formData.destination_label}
                onChange={(e) => setFormData({ ...formData, destination_label: e.target.value })}
                placeholder="Ex: Grupo Crises, Suporte Level 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_id">Unidade Específica (opcional)</Label>
              <Input
                id="unit_id"
                value={formData.unit_id}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                placeholder="Deixe vazio para aplicar globalmente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Maior prioridade = processado primeiro (0 = padrão)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Rota ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {editingRoute ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
