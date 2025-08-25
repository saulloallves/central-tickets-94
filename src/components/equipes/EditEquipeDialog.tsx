import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, X } from 'lucide-react';

interface EditEquipeDialogProps {
  equipe: {
    id: string;
    nome: string;
    descricao: string;
    introducao: string;
    ativo: boolean;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditEquipeDialog = ({ 
  equipe, 
  open, 
  onOpenChange, 
  onSuccess 
}: EditEquipeDialogProps) => {
  const [nome, setNome] = useState(equipe.nome);
  const [descricao, setDescricao] = useState(equipe.descricao);
  const [introducao, setIntroducao] = useState(equipe.introducao);
  const [ativo, setAtivo] = useState(equipe.ativo);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('equipes')
        .update({
          nome: nome.trim(),
          descricao: descricao.trim(),
          introducao: introducao.trim(),
          ativo,
          updated_at: new Date().toISOString()
        })
        .eq('id', equipe.id);

      if (error) throw error;

      toast({
        title: "Equipe atualizada",
        description: "As informações da equipe foram atualizadas com sucesso.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error updating equipe:', error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar a equipe.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNome(equipe.nome);
    setDescricao(equipe.descricao);
    setIntroducao(equipe.introducao);
    setAtivo(equipe.ativo);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Editar Equipe
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Equipe *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Suporte Técnico"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Breve descrição da equipe..."
              rows={3}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="introducao">Introdução</Label>
            <Textarea
              id="introducao"
              value={introducao}
              onChange={(e) => setIntroducao(e.target.value)}
              placeholder="Introdução detalhada sobre a equipe..."
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="ativo" className="text-base font-medium">
                Equipe Ativa
              </Label>
              <p className="text-sm text-muted-foreground">
                Equipes inativas não aparecem para novos membros
              </p>
            </div>
            <Switch
              id="ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};