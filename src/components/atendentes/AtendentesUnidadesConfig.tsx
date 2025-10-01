import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAtendenteUnidadesBulk, AtendenteConfig } from '@/hooks/useAtendenteUnidadesBulk';
import { Loader2, Save, Phone, User, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const AtendentesUnidadesConfig = () => {
  const { loading, fetchAtendentesByTipo, updateAtendente, createAtendente } = useAtendenteUnidadesBulk();
  const [atendentesConcierge, setAtendentesConcierge] = useState<AtendenteConfig[]>([]);
  const [atendentesDfcom, setAtendentesDfcom] = useState<AtendenteConfig[]>([]);
  const [editedAtendentes, setEditedAtendentes] = useState<Map<string, { nome: string; telefone: string }>>(new Map());
  const [saving, setSaving] = useState(false);
  const [creatingConcierge, setCreatingConcierge] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAtendentes();
  }, []);

  const loadAtendentes = async () => {
    const concierge = await fetchAtendentesByTipo('concierge');
    let dfcom = await fetchAtendentesByTipo('dfcom');
    
    // Garantir que sempre existe UM DFCom (global)
    if (dfcom.length === 0) {
      console.log('⚠️ Nenhum DFCom encontrado, criando automaticamente...');
      await createAtendente('DFCom Global', '', 'dfcom');
      dfcom = await fetchAtendentesByTipo('dfcom');
    }
    
    setAtendentesConcierge(concierge);
    setAtendentesDfcom(dfcom);
  };

  const handleEdit = (id: string, currentNome: string, currentTelefone: string, field: 'nome' | 'telefone', value: string) => {
    console.log('🎯 handleEdit chamado:', { id, field, value, currentNome, currentTelefone });
    
    const newMap = new Map(editedAtendentes);
    const current = editedAtendentes.get(id) || { nome: currentNome, telefone: currentTelefone };
    
    // Criar novo objeto para garantir que o React detecte a mudança
    const updated = {
      nome: field === 'nome' ? value : current.nome,
      telefone: field === 'telefone' ? value : current.telefone
    };
    
    console.log('✏️ Novo valor a ser salvo:', updated);
    newMap.set(id, updated);
    setEditedAtendentes(newMap);
    console.log('📝 Estado editedAtendentes atualizado. Total de edições:', newMap.size);
  };

  const handleSaveAll = async () => {
    console.log('💾 handleSaveAll - Total de edições:', editedAtendentes.size);
    
    if (editedAtendentes.size === 0) {
      toast({
        title: "Nenhuma alteração",
        description: "Não há alterações para salvar",
      });
      return;
    }

    setSaving(true);
    try {
      for (const [id, data] of editedAtendentes.entries()) {
        console.log('💾 Salvando atendente:', id, data);
        await updateAtendente(id, data.nome, data.telefone);
      }

      toast({
        title: "Sucesso",
        description: `${editedAtendentes.size} atendente(s) atualizado(s) com sucesso`,
      });

      setEditedAtendentes(new Map());
      await loadAtendentes();
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateConcierge = async () => {
    try {
      await createAtendente('Novo Concierge', '', 'concierge');
      await loadAtendentes();
      setCreatingConcierge(false);
    } catch (error) {
      console.error('Erro ao criar concierge:', error);
    }
  };


  const hasChanges = editedAtendentes.size > 0;

  const handleSaveIndividual = async (id: string) => {
    const data = editedAtendentes.get(id);
    if (!data) return;

    setSaving(true);
    try {
      await updateAtendente(id, data.nome, data.telefone);
      
      // Remover do mapa de edições
      const newMap = new Map(editedAtendentes);
      newMap.delete(id);
      setEditedAtendentes(newMap);
      
      await loadAtendentes();
    } catch (error) {
      console.error('❌ Erro ao salvar atendente individual:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderAtendentesList = (atendentes: AtendenteConfig[], tipo: 'concierge' | 'dfcom') => {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {atendentes.map((atendente) => {
          const edited = editedAtendentes.get(atendente.id);
          const displayNome = edited?.nome ?? atendente.nome;
          const displayTelefone = edited?.telefone ?? atendente.telefone ?? '';
          const isEdited = !!edited;

          return (
            <Card key={atendente.id} className={isEdited ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {tipo === 'concierge' ? 'Concierge' : 'DFCom'}
                  </div>
                  {isEdited && (
                    <Button
                      size="sm"
                      onClick={() => handleSaveIndividual(atendente.id)}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Salvar
                        </>
                      )}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`name-${atendente.id}`}>Nome</Label>
                  <Input
                    id={`name-${atendente.id}`}
                    value={displayNome}
                    onChange={(e) => {
                      console.log('📝 Input Nome onChange:', e.target.value);
                      handleEdit(atendente.id, atendente.nome, atendente.telefone || '', 'nome', e.target.value);
                    }}
                    placeholder="Nome do atendente"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`phone-${atendente.id}`} className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone
                  </Label>
                  <Input
                    id={`phone-${atendente.id}`}
                    value={displayTelefone}
                    onChange={(e) => {
                      console.log('📝 Input Telefone onChange:', e.target.value);
                      handleEdit(atendente.id, atendente.nome, atendente.telefone || '', 'telefone', e.target.value);
                    }}
                    placeholder="Telefone do atendente"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Configuração de Atendentes</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os nomes e telefones dos atendentes Concierge e DFCom.
          </p>
          {hasChanges && (
            <p className="text-sm text-primary font-medium mt-2">
              {editedAtendentes.size} alteração(ões) pendente(s)
            </p>
          )}
        </div>
        {hasChanges && (
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Todas as Alterações
              </>
            )}
          </Button>
        )}
      </div>

      <Tabs defaultValue="concierge" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="concierge">Concierge ({atendentesConcierge.length})</TabsTrigger>
          <TabsTrigger value="dfcom">DFCom ({atendentesDfcom.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="concierge" className="space-y-4">
          <div className="flex justify-end">
            <Button 
              onClick={handleCreateConcierge} 
              disabled={creatingConcierge}
              variant="outline"
              size="sm"
            >
              {creatingConcierge ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Concierge
                </>
              )}
            </Button>
          </div>

          {atendentesConcierge.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum concierge cadastrado</p>
              </CardContent>
            </Card>
          ) : (
            renderAtendentesList(atendentesConcierge, 'concierge')
          )}
        </TabsContent>

        <TabsContent value="dfcom" className="space-y-4">
          <div className="mb-4">
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">DFCom Global</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Existe apenas um atendente DFCom global para todas as unidades. 
                      Configure o nome e telefone abaixo.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {atendentesDfcom.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
                <p className="text-muted-foreground">Carregando configuração DFCom...</p>
              </CardContent>
            </Card>
          ) : (
            renderAtendentesList(atendentesDfcom.slice(0, 1), 'dfcom')
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
