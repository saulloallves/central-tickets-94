import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAtendenteUnidadesBulk, UniqueAtendente } from '@/hooks/useAtendenteUnidadesBulk';
import { Loader2, Save, Users, Phone, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AtendentesUnidadesConfig = () => {
  const { loading, fetchUniqueAtendentes, updateAtendenteInBulk } = useAtendenteUnidadesBulk();
  const [atendentes, setAtendentes] = useState<UniqueAtendente[]>([]);
  const [editedAtendentes, setEditedAtendentes] = useState<Map<string, { newName: string; newPhone: string }>>(new Map());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAtendentes();
  }, []);

  const loadAtendentes = async () => {
    const data = await fetchUniqueAtendentes();
    setAtendentes(data);
  };

  const handleEdit = (oldName: string, oldPhone: string, field: 'name' | 'phone', value: string) => {
    const key = `${oldName}|${oldPhone}`;
    const current = editedAtendentes.get(key) || { newName: oldName, newPhone: oldPhone };
    
    if (field === 'name') {
      current.newName = value;
    } else {
      current.newPhone = value;
    }
    
    const newMap = new Map(editedAtendentes);
    newMap.set(key, current);
    setEditedAtendentes(newMap);
  };

  const handleSaveAll = async () => {
    if (editedAtendentes.size === 0) {
      toast({
        title: "Nenhuma alteração",
        description: "Não há alterações para salvar",
      });
      return;
    }

    setSaving(true);
    try {
      let totalUpdated = 0;
      
      for (const [key, edited] of editedAtendentes.entries()) {
        const [oldName, oldPhone] = key.split('|');
        await updateAtendenteInBulk(oldName, oldPhone, edited.newName, edited.newPhone);
        totalUpdated++;
      }

      toast({
        title: "Sucesso",
        description: `${totalUpdated} atendente(s) atualizado(s) com sucesso`,
      });

      setEditedAtendentes(new Map());
      await loadAtendentes();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = editedAtendentes.size > 0;

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
          <h3 className="text-lg font-semibold">Configuração de Atendentes por Unidade</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os atendentes vinculados às unidades. Alterações aqui afetam todas as unidades associadas.
          </p>
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
                Salvar Alterações
              </>
            )}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {atendentes.map((atendente) => {
          const key = `${atendente.concierge_name}|${atendente.concierge_phone}`;
          const edited = editedAtendentes.get(key);
          const displayName = edited?.newName || atendente.concierge_name;
          const displayPhone = edited?.newPhone || atendente.concierge_phone;
          const isEdited = !!edited;

          return (
            <Card key={key} className={isEdited ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Atendente
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Afeta {atendente.count} unidade(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`name-${key}`}>Nome</Label>
                  <Input
                    id={`name-${key}`}
                    value={displayName}
                    onChange={(e) => handleEdit(atendente.concierge_name, atendente.concierge_phone, 'name', e.target.value)}
                    placeholder="Nome do atendente"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`phone-${key}`} className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone
                  </Label>
                  <Input
                    id={`phone-${key}`}
                    value={displayPhone}
                    onChange={(e) => handleEdit(atendente.concierge_name, atendente.concierge_phone, 'phone', e.target.value)}
                    placeholder="Telefone do atendente"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {atendentes.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum atendente encontrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
