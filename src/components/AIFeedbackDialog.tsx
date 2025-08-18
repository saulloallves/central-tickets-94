
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import { useAIFeedback } from '@/hooks/useAIFeedback';

interface AIFeedbackDialogProps {
  ticketId: string;
  interactionId?: string;
  variant?: 'button' | 'inline';
}

export const AIFeedbackDialog = ({ ticketId, interactionId, variant = 'button' }: AIFeedbackDialogProps) => {
  const [open, setOpen] = useState(false);
  const [util, setUtil] = useState<string>('');
  const [motivo, setMotivo] = useState('');
  const { submitFeedback, loading } = useAIFeedback();

  const handleSubmit = async () => {
    if (!util) return;

    const success = await submitFeedback({
      ticket_id: ticketId,
      interaction_id: interactionId,
      util: util === 'true',
      motivo: util === 'false' ? motivo : undefined
    });

    if (success) {
      setOpen(false);
      setUtil('');
      setMotivo('');
    }
  };

  const trigger = variant === 'button' ? (
    <Button variant="outline" size="sm">
      <MessageSquare className="h-4 w-4" />
      Avaliar IA
    </Button>
  ) : (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm">
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm">
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avaliar Resposta da IA</DialogTitle>
          <DialogDescription>
            Sua avaliação nos ajuda a melhorar as respostas automáticas
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">A resposta foi útil?</Label>
            <RadioGroup value={util} onValueChange={setUtil} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="sim" />
                <Label htmlFor="sim" className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-green-600" />
                  Sim, foi útil
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="nao" />
                <Label htmlFor="nao" className="flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                  Não foi útil
                </Label>
              </div>
            </RadioGroup>
          </div>

          {util === 'false' && (
            <div>
              <Label htmlFor="motivo" className="text-sm font-medium">
                Por que não foi útil? (opcional)
              </Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: resposta incompleta, tom inadequado, informação incorreta..."
                className="mt-1"
                rows={3}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!util || loading}
            >
              {loading ? 'Enviando...' : 'Enviar Avaliação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
