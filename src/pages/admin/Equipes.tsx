import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { EquipeMembersDialog } from "@/components/equipes/EquipeMembersDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface Equipe {
  id: string;
  nome: string;
  descricao: string;
  introducao: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export default function Equipes() {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEquipe, setEditingEquipe] = useState<Equipe | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedEquipeForMembers, setSelectedEquipeForMembers] = useState<Equipe | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    introducao: "",
    ativo: true
  });
  const { toast } = useToast();

  const fetchEquipes = async () => {
    try {
      const { data, error } = await supabase
        .from('equipes')
        .select('*')
        .order('nome');

      if (error) throw error;
      setEquipes(data || []);
    } catch (error) {
      console.error('Error fetching equipes:', error);
      toast({
        title: "Erro ao carregar equipes",
        description: "Não foi possível carregar a lista de equipes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipes();
  }, []);

  const handleSave = async () => {
    try {
      if (editingEquipe) {
        const { error } = await supabase
          .from('equipes')
          .update(formData)
          .eq('id', editingEquipe.id);

        if (error) throw error;
        toast({ title: "Equipe atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from('equipes')
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Equipe criada com sucesso!" });
      }

      setIsDialogOpen(false);
      setEditingEquipe(null);
      setFormData({ nome: "", descricao: "", introducao: "", ativo: true });
      fetchEquipes();
    } catch (error) {
      console.error('Error saving equipe:', error);
      toast({
        title: "Erro ao salvar equipe",
        description: "Não foi possível salvar a equipe.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (equipe: Equipe) => {
    setEditingEquipe(equipe);
    setFormData({
      nome: equipe.nome,
      descricao: equipe.descricao,
      introducao: equipe.introducao,
      ativo: equipe.ativo
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta equipe?")) return;

    try {
      const { error } = await supabase
        .from('equipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Equipe excluída com sucesso!" });
      fetchEquipes();
    } catch (error) {
      console.error('Error deleting equipe:', error);
      toast({
        title: "Erro ao excluir equipe",
        description: "Não foi possível excluir a equipe.",
        variant: "destructive"
      });
    }
  };

  const openCreateDialog = () => {
    setEditingEquipe(null);
    setFormData({ nome: "", descricao: "", introducao: "", ativo: true });
    setIsDialogOpen(true);
  };

  const openMembersDialog = (equipe: Equipe) => {
    setSelectedEquipeForMembers(equipe);
    setMembersDialogOpen(true);
  };

  if (loading) {
    return <div className="p-6">Carregando equipes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Equipes</h1>
          <p className="text-muted-foreground">
            Gerencie as equipes responsáveis pelos tickets. A IA usa essas informações para classificar automaticamente os tickets.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Equipe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEquipe ? "Editar Equipe" : "Nova Equipe"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da Equipe</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Sistema, Jurídico, RH..."
                />
              </div>
              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Breve descrição da equipe"
                />
              </div>
              <div>
                <Label htmlFor="introducao">Introdução para IA</Label>
                <Textarea
                  id="introducao"
                  value={formData.introducao}
                  onChange={(e) => setFormData({ ...formData, introducao: e.target.value })}
                  placeholder="Descreva detalhadamente o que esta equipe faz para a IA entender quando direcionar tickets para ela..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Esta descrição é usada pela IA para classificar automaticamente os tickets. Seja específico sobre os tipos de problemas que esta equipe resolve.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">Equipe ativa</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingEquipe ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {equipes.map((equipe) => (
          <Card key={equipe.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {equipe.nome}
                    <Badge variant={equipe.ativo ? "default" : "secondary"}>
                      {equipe.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{equipe.descricao}</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMembersDialog(equipe)}
                    title="Gerenciar membros"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(equipe)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(equipe.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <h4 className="font-medium mb-2">Introdução para IA:</h4>
                <p className="text-sm text-muted-foreground">{equipe.introducao}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members Dialog */}
      {selectedEquipeForMembers && (
        <EquipeMembersDialog
          equipeId={selectedEquipeForMembers.id}
          equipeNome={selectedEquipeForMembers.nome}
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
        />
      )}

      {equipes.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Nenhuma equipe cadastrada.</p>
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira equipe
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}