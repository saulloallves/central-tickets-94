import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Users, Search, Calendar } from "lucide-react";
import { EquipeMembersDialog } from "@/components/equipes/EquipeMembersDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/ProtectedRoute";

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
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredEquipes = equipes.filter(equipe =>
    equipe.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    equipe.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="w-full space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-2"></div>
            <div className="h-4 bg-muted rounded w-96"></div>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex space-x-4 animate-pulse">
                    <div className="h-4 bg-muted rounded flex-1"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="w-full space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Equipes</h2>
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

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            {filteredEquipes.length} equipes encontradas
          </div>

          {filteredEquipes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  {searchTerm ? 'Nenhuma equipe encontrada com os filtros aplicados.' : 'Nenhuma equipe cadastrada.'}
                </div>
                {!searchTerm && (
                  <Button onClick={openCreateDialog} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeira equipe
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEquipes.map((equipe) => (
                <Dialog key={equipe.id}>
                  <DialogTrigger asChild>
                    <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border bg-white dark:bg-card relative overflow-hidden">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="p-1 bg-green-50 dark:bg-green-900/20 rounded-md">
                            <Users className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                openMembersDialog(equipe);
                              }}
                              title="Gerenciar membros"
                            >
                              <Users className="w-3 h-3 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(equipe);
                              }}
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div>
                            <CardTitle className="text-sm font-semibold leading-tight">
                              {equipe.nome}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {equipe.descricao}
                            </p>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            <div>#{equipe.id.substring(0, 8)}</div>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0 pb-3 px-4">
                        <Badge 
                          className={`${
                            equipe.ativo
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          } border-0 font-medium uppercase text-xs tracking-wide py-1 px-2`}
                        >
                          {equipe.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        <Users className="w-5 h-5" />
                        {equipe.nome}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-2">Informações Básicas</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">ID:</span>
                                <span>{equipe.id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Nome:</span>
                                <span>{equipe.nome}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge variant={equipe.ativo ? "default" : "secondary"}>
                                  {equipe.ativo ? "Ativa" : "Inativa"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-2">Descrição</h4>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Descrição:</span>
                                <p className="mt-1">{equipe.descricao}</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Ações</h4>
                            <div className="space-y-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openMembersDialog(equipe)}
                                className="w-full"
                              >
                                <Users className="h-4 w-4 mr-2" />
                                Gerenciar Membros
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(equipe)}
                                className="w-full"
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar Equipe
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Introdução para IA</h4>
                        <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                          {equipe.introducao}
                        </p>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>Criado em: {new Date(equipe.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          )}
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
      </div>
    </ProtectedRoute>
  );
}