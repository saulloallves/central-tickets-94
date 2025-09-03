import { useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
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
import { useNewCrisisManagement } from '@/hooks/useNewCrisisManagement';
import { useToast } from '@/hooks/use-toast';

interface ResolveCrisisButtonProps {
  ticketId: string;
  size?: 'sm' | 'default';
  className?: string;
}

export const ResolveCrisisButton = ({ ticketId, size = 'default', className }: ResolveCrisisButtonProps) => {
  const { activeCrises, resolveCrisisAndCloseTickets } = useNewCrisisManagement();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Encontrar a crise ativa para este ticket
  const activeCrisis = activeCrises.find(crisis => 
    crisis.crise_ticket_links?.some(link => link.ticket_id === ticketId)
  );

  // Se não há crise ativa para este ticket, não mostrar o botão
  if (!activeCrisis) {
    return null;
  }

  const handleResolveCrisis = async () => {
    setLoading(true);
    try {
      const success = await resolveCrisisAndCloseTickets(
        activeCrisis.id,
        "Crise resolvida pelo sistema",
        "concluido"
      );
      if (success) {
        setOpen(false);
        toast({
          title: "Crise resolvida",
          description: "A crise foi marcada como resolvida e tickets foram finalizados.",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível resolver a crise. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const buttonSize = size === 'sm' ? 'sm' : 'default';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="destructive" 
          size={buttonSize} 
          className={className}
        >
          <AlertTriangle className={`${iconSize} mr-1`} />
          {size === 'sm' ? 'Resolver' : 'Resolver Crise'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Resolver Crise
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja marcar esta crise como resolvida? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-red-50 p-3 rounded border-l-4 border-red-500">
          <h4 className="font-medium text-red-700 mb-1">Título da Crise</h4>
          <p className="text-sm text-red-600">{activeCrisis.titulo}</p>
          {activeCrisis.descricao && (
            <>
              <h4 className="font-medium text-red-700 mb-1 mt-2">Descrição</h4>
              <p className="text-sm text-red-600">{activeCrisis.descricao}</p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            variant="destructive"
            onClick={handleResolveCrisis}
            disabled={loading}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {loading ? 'Resolvendo...' : 'Resolver Crise'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};