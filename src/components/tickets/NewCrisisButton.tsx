
import { useState } from 'react';
import { AlertTriangle, Zap, Plus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useNewCrisisManagement } from '@/hooks/useNewCrisisManagement';
import { useToast } from '@/hooks/use-toast';

interface NewCrisisButtonProps {
  ticketId: string;
  currentPriority: string;
  ticketInfo?: {
    codigo_ticket?: string;
    unidade?: string;
    categoria?: string;
  };
}

export const NewCrisisButton = ({ ticketId, currentPriority, ticketInfo }: NewCrisisButtonProps) => {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const { createCrisis, addTicketsToCrisis, activeCrises } = useNewCrisisManagement();
  const { toast } = useToast();

  // Verificar se o ticket já está em alguma crise ativa
  const isTicketInCrisis = activeCrises.some(crisis => 
    crisis.crise_ticket_links?.some(link => link.ticket_id === ticketId)
  );

  const handleCreateCrisis = async () => {
    if (!titulo.trim()) return;
    
    setLoading(true);
    
    try {
      const palavrasChave = [];
      if (ticketInfo?.categoria) {
        palavrasChave.push(ticketInfo.categoria);
      }
      if (ticketInfo?.unidade) {
        palavrasChave.push(ticketInfo.unidade);
      }

      const criseId = await createCrisis(
        titulo,
        descricao,
        palavrasChave,
        [ticketId]
      );

      if (criseId) {
        toast({
          title: "🚨 CRISE CRIADA",
          description: `Crise "${titulo}" foi criada e o ticket foi vinculado.`,
          variant: "destructive",
        });

        setOpen(false);
        setTitulo('');
        setDescricao('');
        
        // Refresh the page to update the ticket display
        window.location.reload();
      }
    } catch (error) {
      console.error('Error creating crisis:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao criar crise",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddToExistingCrisis = async (crisisId: string) => {
    setLoading(true);
    
    try {
      const success = await addTicketsToCrisis(crisisId, [ticketId]);
      
      if (success) {
        toast({
          title: "Ticket Vinculado",
          description: "Ticket foi vinculado à crise existente.",
        });
        setOpen(false);
        window.location.reload();
      }
    } catch (error) {
      console.error('Error adding ticket to crisis:', error);
      toast({
        title: "Erro",
        description: "Erro ao vincular ticket à crise",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Se já é crise, mostrar status
  if (currentPriority === 'crise' || isTicketInCrisis) {
    const crisis = activeCrises.find(crisis => 
      crisis.crise_ticket_links?.some(link => link.ticket_id === ticketId)
    );
    
    return (
      <Button variant="destructive" size="sm" disabled>
        <Zap className="h-4 w-4 mr-2" />
        {crisis ? `EM CRISE: ${crisis.titulo.substring(0, 20)}...` : 'EM CRISE'}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-red-500 text-red-600 hover:bg-red-50">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Criar/Vincular Crise
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Gestão de Crise
          </DialogTitle>
          <DialogDescription className="text-sm">
            <div className="bg-red-50 p-3 rounded mb-3">
              <p className="font-medium text-red-700 mb-2">🚨 MODO CRISE AGREGADO</p>
              <p className="text-red-600 text-xs">
                Crie uma nova crise ou vincule este ticket a uma crise existente.
              </p>
            </div>
            
            {activeCrises.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Crises Ativas:</h4>
                <div className="space-y-2">
                  {activeCrises.slice(0, 3).map((crisis) => (
                    <div key={crisis.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <span className="text-sm font-medium">{crisis.titulo}</span>
                        <div className="text-xs text-muted-foreground">
                          {crisis.crise_ticket_links?.length || 0} tickets • {crisis.status}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddToExistingCrisis(crisis.id)}
                        disabled={loading}
                      >
                        Vincular
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Título da nova crise: *
            </label>
            <Input
              placeholder={`Crise - ${ticketInfo?.categoria || 'Geral'} - ${ticketInfo?.unidade || 'Sistema'}`}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Descrição (opcional):
            </label>
            <Textarea
              placeholder="Descreva o problema que está afetando múltiplos tickets..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Esta crise agrupará tickets similares para gestão centralizada.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCreateCrisis}
            disabled={!titulo.trim() || loading}
            className="bg-red-600 hover:bg-red-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {loading ? 'Criando Crise...' : 'CRIAR CRISE'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
