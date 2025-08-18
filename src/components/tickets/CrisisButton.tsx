
import { useState } from 'react';
import { AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';

interface CrisisButtonProps {
  ticketId: string;
  currentPriority: string;
}

export const CrisisButton = ({ ticketId, currentPriority }: CrisisButtonProps) => {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const { markAsCrisis, loading } = useAIAnalysis();

  const handleMarkAsCrisis = async () => {
    if (!motivo.trim()) return;
    
    const success = await markAsCrisis(ticketId, motivo);
    if (success) {
      setOpen(false);
      setMotivo('');
    }
  };

  // Não mostrar se já é crise
  if (currentPriority === 'crise') {
    return (
      <Button variant="destructive" size="sm" disabled>
        <Zap className="h-4 w-4 mr-2" />
        EM CRISE
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-red-500 text-red-600 hover:bg-red-50">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Marcar como Crise
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Marcar como CRISE
          </DialogTitle>
          <DialogDescription className="text-sm">
            Esta ação irá:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Escalar imediatamente para a diretoria</li>
              <li>Enviar notificações urgentes via WhatsApp</li>
              <li>Marcar o ticket com prioridade máxima</li>
              <li>Registrar no log de auditoria</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Motivo da classificação como crise:
            </label>
            <Textarea
              placeholder="Descreva por que este ticket é uma crise (ex: sistema fora do ar, perda total de vendas, problema crítico...)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleMarkAsCrisis}
            disabled={!motivo.trim() || loading}
          >
            <Zap className="h-4 w-4 mr-2" />
            {loading ? 'Processando...' : 'Confirmar CRISE'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
