import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2 } from 'lucide-react';

interface AddUnidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (codigoGrupo: string) => Promise<boolean>;
}

export function AddUnidadeDialog({ open, onOpenChange, onAdd }: AddUnidadeDialogProps) {
  const [codigoGrupo, setCodigoGrupo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoGrupo.trim()) return;

    setLoading(true);
    const success = await onAdd(codigoGrupo.trim());
    setLoading(false);

    if (success) {
      setCodigoGrupo('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Adicionar Unidade ao Acompanhamento
          </DialogTitle>
          <DialogDescription>
            Digite o código da unidade que entrará no acompanhamento operacional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="codigo_grupo">Código da Unidade</Label>
              <Input
                id="codigo_grupo"
                value={codigoGrupo}
                onChange={(e) => setCodigoGrupo(e.target.value)}
                placeholder="Ex: 1234"
                autoFocus
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground">
                A unidade receberá uma notificação automática informando sobre o acompanhamento.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !codigoGrupo.trim()}>
              {loading ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
