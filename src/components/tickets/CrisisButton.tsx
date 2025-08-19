
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CrisisButtonProps {
  ticketId: string;
  currentPriority: string;
}

export const CrisisButton = ({ ticketId, currentPriority }: CrisisButtonProps) => {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleMarkAsCrisis = async () => {
    if (!motivo.trim()) return;
    
    setLoading(true);
    
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc('activate_crisis', {
        p_ticket_id: ticketId,
        p_motivo: motivo,
        p_criada_por: user.user?.id,
        p_impacto_regional: null
      });

      if (error) {
        console.error('Error activating crisis:', error);
        toast({
          title: "Erro",
          description: "Não foi possível ativar a crise",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "🚨 CRISE ATIVADA",
        description: "Notificações enviadas para toda a hierarquia. Protocolo de emergência iniciado.",
        variant: "destructive",
      });

      setOpen(false);
      setMotivo('');
      
      // Refresh the page to update the ticket display
      window.location.reload();
    } catch (error) {
      console.error('Error marking as crisis:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao ativar crise",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
            Ativar MODO CRISE
          </DialogTitle>
          <DialogDescription className="text-sm">
            <div className="bg-red-50 p-3 rounded mb-3">
              <p className="font-medium text-red-700 mb-2">⚠️ ATENÇÃO: Protocolo de Emergência</p>
              <p className="text-red-600 text-xs">
                Esta ação irá ativar o modo crise e disparar alertas para toda a hierarquia.
              </p>
            </div>
            Esta ação irá:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Escalar imediatamente para a diretoria</li>
              <li>Enviar notificações urgentes via WhatsApp</li>
              <li>Marcar o ticket com prioridade CRISE</li>
              <li>Ativar protocolo de resposta de emergência</li>
              <li>Registrar no log de auditoria</li>
              <li>Exibir alerta visual global no sistema</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Motivo da ativação da crise: *
            </label>
            <Textarea
              placeholder="Descreva por que este ticket é uma crise (ex: sistema fora do ar afetando vendas, reclamação judicial, problema crítico de segurança...)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Seja específico - esta informação será usada nos protocolos de resposta.
            </p>
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
            className="bg-red-600 hover:bg-red-700"
          >
            <Zap className="h-4 w-4 mr-2" />
            {loading ? 'Ativando Crise...' : 'ATIVAR CRISE'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
