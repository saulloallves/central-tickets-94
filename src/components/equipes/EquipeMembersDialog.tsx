import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Users, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EquipeMember {
  id: string;
  user_id: string;
  role: string;
  is_primary: boolean;
  ativo: boolean;
  profiles: {
    nome_completo: string;
    email: string;
  };
}

interface Profile {
  id: string;
  nome_completo: string;
  email: string;
}

interface EquipeMembersDialogProps {
  equipeId: string;
  equipeNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EquipeMembersDialog({ equipeId, equipeNome, open, onOpenChange }: EquipeMembersDialogProps) {
  const [members, setMembers] = useState<EquipeMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [newMember, setNewMember] = useState({
    user_id: "",
    role: "member",
    is_primary: false
  });
  const { toast } = useToast();

  const fetchMembers = async () => {
    if (!equipeId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('equipe_members')
        .select(`
          *,
          profiles:user_id (
            nome_completo,
            email
          )
        `)
        .eq('equipe_id', equipeId)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: "Erro ao carregar membros",
        description: "Não foi possível carregar os membros da equipe.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome_completo, email')
        .order('nome_completo');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchAvailableUsers();
    }
  }, [open, equipeId]);

  const handleAddMember = async () => {
    if (!newMember.user_id) {
      toast({
        title: "Selecione um usuário",
        variant: "destructive"
      });
      return;
    }

    // Verificar se já é membro
    const existingMember = members.find(m => m.user_id === newMember.user_id);
    if (existingMember) {
      toast({
        title: "Usuário já é membro desta equipe",
        variant: "destructive"
      });
      return;
    }

    // Se está marcando como primário, desmarcar outros
    let updateData = { ...newMember, equipe_id: equipeId };
    
    try {
      if (newMember.is_primary) {
        await supabase
          .from('equipe_members')
          .update({ is_primary: false })
          .eq('equipe_id', equipeId);
      }

      const { error } = await supabase
        .from('equipe_members')
        .insert([updateData]);

      if (error) throw error;

      toast({ title: "Membro adicionado com sucesso!" });
      setNewMember({ user_id: "", role: "member", is_primary: false });
      setAddingMember(false);
      fetchMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      toast({
        title: "Erro ao adicionar membro",
        description: "Não foi possível adicionar o membro à equipe.",
        variant: "destructive"
      });
    }
  };

  const handleTogglePrimary = async (memberId: string, currentPrimary: boolean) => {
    try {
      if (!currentPrimary) {
        // Desmarcar outros como primário
        await supabase
          .from('equipe_members')
          .update({ is_primary: false })
          .eq('equipe_id', equipeId);
      }

      const { error } = await supabase
        .from('equipe_members')
        .update({ is_primary: !currentPrimary })
        .eq('id', memberId);

      if (error) throw error;
      
      toast({ 
        title: !currentPrimary ? "Membro definido como primário" : "Membro não é mais primário" 
      });
      fetchMembers();
    } catch (error) {
      console.error('Error updating primary status:', error);
      toast({
        title: "Erro ao atualizar status",
        variant: "destructive"
      });
    }
  };

  const handleToggleActive = async (memberId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('equipe_members')
        .update({ ativo: !currentActive })
        .eq('id', memberId);

      if (error) throw error;
      
      toast({ 
        title: !currentActive ? "Membro ativado" : "Membro desativado" 
      });
      fetchMembers();
    } catch (error) {
      console.error('Error updating active status:', error);
      toast({
        title: "Erro ao atualizar status",
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Tem certeza que deseja remover este membro da equipe?")) return;

    try {
      const { error } = await supabase
        .from('equipe_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      
      toast({ title: "Membro removido com sucesso!" });
      fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Erro ao remover membro",
        variant: "destructive"
      });
    }
  };

  const availableUsersToAdd = availableUsers.filter(
    user => !members.some(member => member.user_id === user.id)
  );

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Membros da Equipe: {equipeNome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Member Form */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Adicionar Membro</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddingMember(!addingMember)}
              >
                <Plus className="h-4 w-4 mr-2" />
                {addingMember ? "Cancelar" : "Adicionar"}
              </Button>
            </div>

            {addingMember && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Usuário</Label>
                  <Select
                    value={newMember.user_id}
                    onValueChange={(value) => setNewMember({ ...newMember, user_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsersToAdd.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.nome_completo} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Label>Papel na equipe</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Define o papel do membro dentro desta equipe específica, não o cargo de RH da empresa.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={newMember.role}
                    onValueChange={(value) => setNewMember({ ...newMember, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="leader">Líder</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 mt-6">
                  <Switch
                    id="primary"
                    checked={newMember.is_primary}
                    onCheckedChange={(checked) => setNewMember({ ...newMember, is_primary: checked })}
                  />
                  <Label htmlFor="primary">Primário</Label>
                </div>

                <div className="flex items-end">
                  <Button onClick={handleAddMember} className="w-full">
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Members List */}
          <div>
            <h3 className="font-medium mb-4">Membros Atuais ({members.length})</h3>
            
            {loading ? (
              <p className="text-muted-foreground">Carregando membros...</p>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground">Nenhum membro cadastrado nesta equipe.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel na Equipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {member.profiles?.nome_completo || "Nome não disponível"}
                          {member.is_primary && (
                            <Badge variant="default" className="text-xs">
                              Primário
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{member.profiles?.email || "Email não disponível"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.ativo ? "default" : "secondary"}>
                          {member.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={member.is_primary}
                            onCheckedChange={() => handleTogglePrimary(member.id, member.is_primary)}
                            title="Definir como primário"
                          />
                          <Switch
                            checked={member.ativo}
                            onCheckedChange={() => handleToggleActive(member.id, member.ativo)}
                            title="Ativar/Desativar"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Remover da equipe"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}