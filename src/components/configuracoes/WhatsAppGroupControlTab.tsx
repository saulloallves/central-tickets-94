import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Lock, Unlock, UserPlus, UserMinus, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function WhatsAppGroupControlTab() {
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminName, setAdminName] = useState("");
  const queryClient = useQueryClient();

  // Buscar grupos cadastrados
  const { data: groups, isLoading } = useQuery({
    queryKey: ['whatsapp-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select(`
          *,
          whatsapp_group_admins(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const controlGroupMutation = useMutation({
    mutationFn: async ({ action, groupId, phone, nome }: any) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-group-control', {
        body: { action, groupId, phone, nome }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      
      const messages: Record<string, string> = {
        'add_admin': 'Admin adicionado com sucesso',
        'remove_admin': 'Admin removido com sucesso',
        'close_group': 'Grupo fechado com sucesso',
        'open_group': 'Grupo aberto com sucesso'
      };
      
      toast.success(messages[variables.action] || 'Ação realizada com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const handleAddGroup = () => {
    if (!groupId || !groupName) {
      toast.error("Preencha ID e Nome do grupo");
      return;
    }

    controlGroupMutation.mutate({
      action: 'add_group',
      groupId,
      nome: groupName
    });

    setGroupId("");
    setGroupName("");
  };

  const handleAddAdmin = (gId: string) => {
    if (!adminPhone) {
      toast.error("Informe o telefone do admin");
      return;
    }

    controlGroupMutation.mutate({
      action: 'add_admin',
      groupId: gId,
      phone: adminPhone,
      nome: adminName
    });

    setAdminPhone("");
    setAdminName("");
  };

  const handleRemoveAdmin = (gId: string, phone: string) => {
    controlGroupMutation.mutate({
      action: 'remove_admin',
      groupId: gId,
      phone
    });
  };

  const handleToggleGroup = (group: any) => {
    const action = group.status === 'aberto' ? 'close_group' : 'open_group';
    controlGroupMutation.mutate({
      action,
      groupId: group.group_id
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Controle de Grupos WhatsApp</CardTitle>
          <CardDescription>
            Gerencie admins e controle abertura/fechamento de grupos WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="groupId">ID do Grupo WhatsApp</Label>
              <Input
                id="groupId"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                placeholder="120363123456789@g.us"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupName">Nome do Grupo</Label>
              <Input
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Suporte Técnico"
              />
            </div>
          </div>
          <Button onClick={handleAddGroup} disabled={controlGroupMutation.isPending}>
            Adicionar Grupo
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-center text-muted-foreground">Carregando grupos...</p>
        ) : groups && groups.length > 0 ? (
          groups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.nome}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {group.group_id}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={group.status === 'aberto' ? 'default' : 'secondary'}>
                      {group.status === 'aberto' ? 'Aberto' : 'Fechado'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleGroup(group)}
                      disabled={controlGroupMutation.isPending}
                    >
                      {group.status === 'aberto' ? (
                        <>
                          <Lock className="h-4 w-4 mr-2" />
                          Fechar
                        </>
                      ) : (
                        <>
                          <Unlock className="h-4 w-4 mr-2" />
                          Abrir
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Admins do Grupo</h4>
                    <div className="space-y-2">
                      {group.whatsapp_group_admins
                        ?.filter((admin: any) => admin.is_active)
                        .map((admin: any) => (
                          <div
                            key={admin.id}
                            className="flex items-center justify-between p-2 border rounded"
                          >
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              <span className="text-sm">{admin.nome || admin.phone}</span>
                              <span className="text-xs text-muted-foreground font-mono">
                                {admin.phone}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveAdmin(group.group_id, admin.phone)}
                              disabled={controlGroupMutation.isPending}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Adicionar Admin
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Admin ao Grupo</DialogTitle>
                        <DialogDescription>
                          Informe os dados do participante que será promovido a admin
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="adminPhone">Telefone (com DDI)</Label>
                          <Input
                            id="adminPhone"
                            value={adminPhone}
                            onChange={(e) => setAdminPhone(e.target.value)}
                            placeholder="5511999999999"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="adminName">Nome (opcional)</Label>
                          <Input
                            id="adminName"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            placeholder="João Silva"
                          />
                        </div>
                        <Button
                          onClick={() => handleAddAdmin(group.group_id)}
                          disabled={controlGroupMutation.isPending}
                          className="w-full"
                        >
                          Adicionar Admin
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum grupo cadastrado. Adicione um grupo acima para começar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
