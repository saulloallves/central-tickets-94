import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAtendenteUnidadesBulk, UniqueAtendente } from '@/hooks/useAtendenteUnidadesBulk';
import { Loader2, Save, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface AtendentesConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AtendenteEdit extends UniqueAtendente {
  newName: string;
  newPhone: string;
  hasChanges: boolean;
}

export const AtendentesConfigModal = ({ open, onOpenChange }: AtendentesConfigModalProps) => {
  const [atendentes, setAtendentes] = useState<AtendenteEdit[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const { loading, fetchUniqueAtendentes, updateAtendenteInBulk } = useAtendenteUnidadesBulk();

  useEffect(() => {
    if (open) {
      loadAtendentes();
    }
  }, [open]);

  const loadAtendentes = async () => {
    setLoadingData(true);
    const data = await fetchUniqueAtendentes();
    setAtendentes(data.map(a => ({
      ...a,
      newName: a.concierge_name,
      newPhone: a.concierge_phone,
      hasChanges: false
    })));
    setLoadingData(false);
  };

  const handleNameChange = (index: number, value: string) => {
    setAtendentes(prev => prev.map((a, i) => {
      if (i === index) {
        return {
          ...a,
          newName: value,
          hasChanges: value !== a.concierge_name || a.newPhone !== a.concierge_phone
        };
      }
      return a;
    }));
  };

  const handlePhoneChange = (index: number, value: string) => {
    setAtendentes(prev => prev.map((a, i) => {
      if (i === index) {
        return {
          ...a,
          newPhone: value,
          hasChanges: a.newName !== a.concierge_name || value !== a.concierge_phone
        };
      }
      return a;
    }));
  };

  const handleSaveAll = async () => {
    const changedAtendentes = atendentes.filter(a => a.hasChanges);
    
    if (changedAtendentes.length === 0) {
      onOpenChange(false);
      return;
    }

    try {
      for (const atendente of changedAtendentes) {
        await updateAtendenteInBulk(
          atendente.concierge_name,
          atendente.concierge_phone,
          atendente.newName,
          atendente.newPhone
        );
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar alterações:', error);
    }
  };

  const totalChanges = atendentes.filter(a => a.hasChanges).length;
  const totalAffectedUnits = atendentes
    .filter(a => a.hasChanges)
    .reduce((sum, a) => sum + a.count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Configuração de Atendentes (Edição em Massa)
          </DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {atendentes.map((atendente, index) => (
                  <div key={`${atendente.concierge_name}-${atendente.concierge_phone}`}>
                    <div className="liquid-glass-card p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Afeta {atendente.count} unidade{atendente.count !== 1 ? 's' : ''}
                        </span>
                        {atendente.hasChanges && (
                          <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">
                            Modificado
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <Label htmlFor={`name-${index}`}>Nome do Atendente</Label>
                          <Input
                            id={`name-${index}`}
                            value={atendente.newName}
                            onChange={(e) => handleNameChange(index, e.target.value)}
                            placeholder="Nome completo"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={`phone-${index}`}>Telefone</Label>
                          <Input
                            id={`phone-${index}`}
                            value={atendente.newPhone}
                            onChange={(e) => handlePhoneChange(index, e.target.value)}
                            placeholder="5511999999999"
                          />
                        </div>
                      </div>
                    </div>
                    {index < atendentes.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {totalChanges > 0 && (
              <div className="bg-primary/10 p-3 rounded-lg">
                <p className="text-sm font-medium">
                  {totalChanges} atendente{totalChanges !== 1 ? 's' : ''} será{totalChanges !== 1 ? 'm' : ''} atualizado{totalChanges !== 1 ? 's' : ''} em {totalAffectedUnits} unidade{totalAffectedUnits !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSaveAll} 
            disabled={loading || totalChanges === 0}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Tudo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
