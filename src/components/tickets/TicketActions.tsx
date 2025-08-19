
import { useState } from 'react';
import { Play, CheckCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [concludeDialogOpen, setConcludeDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStartAttendance = async () => {
    if (!selectedEquipe) return;
    
    setLoading(true);
    try {
      await startAttendance(ticket.id, selectedEquipe);
      setStartDialogOpen(false);
      setSelectedEquipe('');
    } finally {
      setLoading(false);
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

  return (
    <div className="flex gap-2">
      {/* Botão Iniciar Atendimento - só aparece se não estiver em atendimento ou concluído */}
      {ticket.status === 'aberto' && (
        <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size={buttonSize}>
              <Play className={`${iconSize} mr-2`} />
              {size === 'sm' ? 'Iniciar' : 'Iniciar Atendimento'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Iniciar Atendimento</DialogTitle>
              <DialogDescription>
                Selecione a equipe responsável para iniciar o atendimento deste ticket.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Equipe Responsável</label>
                <Select value={selectedEquipe} onValueChange={setSelectedEquipe}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipes.map((equipe) => (
                      <SelectItem key={equipe.id} value={equipe.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {equipe.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStartDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleStartAttendance}
                disabled={!selectedEquipe || loading}
              >
                {loading ? 'Iniciando...' : 'Iniciar Atendimento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Botão Concluir - só aparece se estiver em atendimento */}
      {ticket.status === 'em_atendimento' && (
        <Dialog open={concludeDialogOpen} onOpenChange={setConcludeDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size={buttonSize}>
              <CheckCircle className={`${iconSize} mr-2`} />
              {size === 'sm' ? 'Concluir' : 'Concluído'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Concluir Ticket</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja marcar este ticket como concluído?
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
                {loading ? 'Concluindo...' : 'Concluir Ticket'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Mostrar info de quem iniciou o atendimento */}
      {ticket.status === 'em_atendimento' && ticket.atendimento_iniciado_por_profile && (
        <Badge variant="secondary" className="text-xs">
          Por: {ticket.atendimento_iniciado_por_profile.nome_completo}
        </Badge>
      )}

      {/* Mostrar se já foi concluído */}
      {ticket.status === 'concluido' && (
        <Badge variant="default" className="text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Concluído
        </Badge>
      )}
    </div>
  );
};
