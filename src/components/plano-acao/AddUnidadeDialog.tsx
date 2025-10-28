import { useState, useEffect } from 'react';
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
import { Building2, CheckCircle2, XCircle, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { debounce } from '@/lib/debounce';

interface UnidadeInfo {
  id: string;
  codigo_grupo: string;
  grupo: string | null;
  fantasy_name: string | null;
  cidade: string | null;
  estado: string | null;
}

interface AddUnidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (codigoGrupo: string) => Promise<boolean>;
}

export function AddUnidadeDialog({ open, onOpenChange, onAdd }: AddUnidadeDialogProps) {
  const [codigoGrupo, setCodigoGrupo] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [unidadeInfo, setUnidadeInfo] = useState<UnidadeInfo | null>(null);
  const [error, setError] = useState<string>('');

  const validateUnidade = async (codigo: string) => {
    if (!codigo || codigo.length < 3) {
      setUnidadeInfo(null);
      setError('');
      return;
    }

    setValidating(true);
    setError('');
    setUnidadeInfo(null);

    try {
      // Buscar unidade na tabela 'unidades'
      const { data: unidade, error: unidadeError } = await supabase
        .from('unidades')
        .select('id, codigo_grupo, grupo, fantasy_name, cidade, estado')
        .eq('codigo_grupo', codigo)
        .maybeSingle();

      if (unidadeError) throw unidadeError;

      if (!unidade) {
        setError('Unidade não encontrada');
        setValidating(false);
        return;
      }

      setUnidadeInfo(unidade);
    } catch (err) {
      console.error('Erro ao validar unidade:', err);
      setError('Erro ao buscar unidade');
    } finally {
      setValidating(false);
    }
  };

  const debouncedValidate = debounce(validateUnidade, 500);

  useEffect(() => {
    debouncedValidate(codigoGrupo.trim());
  }, [codigoGrupo]);

  useEffect(() => {
    if (!open) {
      setCodigoGrupo('');
      setUnidadeInfo(null);
      setError('');
      setValidating(false);
    }
  }, [open]);

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
              <div className="relative">
                <Input
                  id="codigo_grupo"
                  value={codigoGrupo}
                  onChange={(e) => setCodigoGrupo(e.target.value)}
                  placeholder="Ex: 1234"
                  autoFocus
                  disabled={loading}
                  className="pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {validating && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!validating && unidadeInfo && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  {!validating && error && (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>

              {/* Informações da unidade encontrada */}
              {unidadeInfo && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-md space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Unidade encontrada
                  </div>
                  {unidadeInfo.fantasy_name && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                      <Building2 className="h-3 w-3" />
                      {unidadeInfo.fantasy_name}
                    </div>
                  )}
                  {(unidadeInfo.cidade || unidadeInfo.estado) && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                      <MapPin className="h-3 w-3" />
                      {unidadeInfo.cidade && unidadeInfo.estado 
                        ? `${unidadeInfo.cidade} - ${unidadeInfo.estado}`
                        : unidadeInfo.cidade || unidadeInfo.estado}
                    </div>
                  )}
                </div>
              )}

              {/* Mensagem de erro */}
              {error && (
                <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                </div>
              )}

              {!error && !unidadeInfo && (
                <p className="text-sm text-muted-foreground">
                  A unidade receberá uma notificação automática informando sobre o acompanhamento.
                </p>
              )}
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
            <Button 
              type="submit" 
              disabled={loading || !codigoGrupo.trim() || !unidadeInfo || !!error || validating}
            >
              {loading ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
