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
import { Calendar } from 'lucide-react';
import type { Acompanhamento } from '@/hooks/useAcompanhamento';

interface AgendarReuniaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acompanhamento: Acompanhamento | null;
  onAgendar: (acompanhamentoId: string, data: string, responsavelId: string | null, responsavelNome: string) => Promise<boolean>;
}

export function AgendarReuniaoDialog({
  open,
  onOpenChange,
  acompanhamento,
  onAgendar
}: AgendarReuniaoDialogProps) {
  const [dataReuniao, setDataReuniao] = useState('');
  const [horaReuniao, setHoraReuniao] = useState('');
  const [responsavelNome, setResponsavelNome] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acompanhamento || !dataReuniao || !horaReuniao || !responsavelNome.trim()) return;

    setLoading(true);
    const dataHoraCompleta = `${dataReuniao}T${horaReuniao}:00`;
    const success = await onAgendar(
      acompanhamento.id,
      dataHoraCompleta,
      null, // responsavelId pode ser implementado depois com seleção de usuários
      responsavelNome.trim()
    );
    setLoading(false);

    if (success) {
      setDataReuniao('');
      setHoraReuniao('');
      setResponsavelNome('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agendar Reunião Inicial
          </DialogTitle>
          <DialogDescription>
            {acompanhamento?.unidade?.fantasy_name || acompanhamento?.codigo_grupo}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="data">Data da Reunião</Label>
              <Input
                id="data"
                type="date"
                value={dataReuniao}
                onChange={(e) => setDataReuniao(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="hora">Horário</Label>
              <Input
                id="hora"
                type="time"
                value={horaReuniao}
                onChange={(e) => setHoraReuniao(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="responsavel">Consultor Responsável</Label>
              <Input
                id="responsavel"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                placeholder="Nome do consultor"
                disabled={loading}
                required
              />
            </div>

            <div className="p-3 bg-primary/5 rounded-md text-sm text-muted-foreground">
              💡 O franqueado receberá uma notificação automática com os detalhes da reunião e um link para confirmação.
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
              disabled={loading || !dataReuniao || !horaReuniao || !responsavelNome.trim()}
            >
              {loading ? 'Agendando...' : 'Agendar Reunião'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
