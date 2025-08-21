import { useState } from 'react';
import { Play, CheckCircle, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResolveCrisisButton } from './ResolveCrisisButton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTickets, type Ticket } from '@/hooks/useTickets';
import { useUserEquipes } from '@/hooks/useUserEquipes';
import { useOptimisticTicketActions } from '@/hooks/useOptimisticTicketActions';

interface TicketActionsProps {
  ticket: Ticket;
  equipes: Array<{ id: string; nome: string }>;
  size?: 'sm' | 'default';
}

export const TicketActions = ({ ticket, equipes, size = 'default' }: TicketActionsProps) => {
  const { startAttendance, concludeTicket } = useTickets({
    search: '',
    status: 'all',
    categoria: 'all',
    prioridade: 'all',
    unidade_id: 'all',
    status_sla: 'all',
    equipe_id: 'all'
  });
  
  const { userEquipes, getPrimaryEquipe } = useUserEquipes();
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [concludeDialogOpen, setConcludeDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStartAttendance = async () => {
    setLoading(true);
    try {
      // Se o usuário tem múltiplas equipes e não selecionou uma, exigir seleção
      if (userEquipes.length > 1 && !selectedEquipe && !getPrimaryEquipe()) {
        return; // Dialog permanece aberto para seleção
      }
      
      await startAttendance(ticket.id, selectedEquipe || undefined);
      setStartDialogOpen(false);
      setSelectedEquipe('');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStart = async () => {
    // Início rápido: tentar iniciar sem dialog se possível
    if (userEquipes.length <= 1 || getPrimaryEquipe()) {
      setLoading(true);
      try {
        await startAttendance(ticket.id);
      } finally {
        setLoading(false);
      }
    } else {
      // Múltiplas equipes sem primária: abrir dialog
      setStartDialogOpen(true);
    }
  };

  const handleConclude = async () => {
    setLoading(true);
    try {
      await concludeTicket(ticket.id);
      setConcludeDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const buttonSize = size === 'sm' ? 'sm' : 'default';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  const needsEquipeSelection = userEquipes.length > 1 && !getPrimaryEquipe();

  return (
    <div className="flex gap-2">
      {/* Botão Concluir/Resolver - aparece para tickets não concluídos */}
      {ticket.status !== 'concluido' && (
        <Dialog open={concludeDialogOpen} onOpenChange={setConcludeDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size={buttonSize}>
              <CheckCircle className={`${iconSize} mr-2`} />
              {size === 'sm' ? 'Resolver' : 'Resolver'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolver Ticket</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja marcar este ticket como resolvido?
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConcludeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConclude}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resolvendo...
                  </>
                ) : (
                  'Resolver Ticket'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Mostrar se já foi resolvido */}
      {ticket.status === 'concluido' && (
        <Badge variant="default" className="text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Resolvido
        </Badge>
      )}
    </div>
  );
};
