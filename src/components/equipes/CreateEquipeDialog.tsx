import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Save, X } from 'lucide-react';

interface CreateEquipeDialogProps {
  onSuccess?: () => void;
}

export const CreateEquipeDialog = ({ onSuccess }: CreateEquipeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [introducao, setIntroducao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('equipes')
        .insert({
          nome: nome.trim(),
          descricao: descricao.trim(),
          introducao: introducao.trim(),
          ativo,
        });

      if (error) throw error;

      toast({
        title: "Equipe criada",
        description: "A nova equipe foi criada com sucesso.",
      });

      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating equipe:', error);
      toast({
        title: "Erro ao criar equipe",
        description: error.message || "Não foi possível criar a equipe.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNome('');
    setDescricao('');
    setIntroducao('');
    setAtivo(true);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      setOpen(open);
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Equipe
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Criar Nova Equipe
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
                Equipes ativas aparecem para novos membros
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
              onClick={() => setOpen(false)}
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
              Criar Equipe
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};