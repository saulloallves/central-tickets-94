import React from 'react';
import { Calendar as CalendarIcon, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface StepPrazosProps {
  prazo: string;
  responsavelLocal: string;
  onPrazoChange: (value: string) => void;
  onResponsavelChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

export const StepPrazos: React.FC<StepPrazosProps> = ({
  prazo,
  responsavelLocal,
  onPrazoChange,
  onResponsavelChange,
  onValidationChange,
}) => {
  const [date, setDate] = React.useState<Date | undefined>(
    prazo ? new Date(prazo) : undefined
  );

  React.useEffect(() => {
    const isValidDate = prazo && new Date(prazo) > new Date();
    const isValidResponsavel = responsavelLocal.trim().length >= 3;
    onValidationChange(!!isValidDate && isValidResponsavel);
  }, [prazo, responsavelLocal, onValidationChange]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    if (selectedDate) {
      onPrazoChange(format(selectedDate, 'yyyy-MM-dd'));
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <CalendarIcon className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">📅 Prazos e Responsável Local</h3>
        <p className="text-muted-foreground">
          Defina o <strong>prazo sugerido para conclusão</strong> e o <strong>responsável local</strong>
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <Label>Data de Prazo</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                disabled={(date) => date < new Date()}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {prazo && new Date(prazo) <= new Date() && (
            <p className="text-xs text-destructive">A data deve ser futura</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsavel_local">
            <User className="h-4 w-4 inline mr-2" />
            Responsável Local (na unidade)
          </Label>
          <Input
            id="responsavel_local"
            type="text"
            placeholder="Nome do responsável na unidade"
            value={responsavelLocal}
            onChange={(e) => onResponsavelChange(e.target.value)}
          />
          {responsavelLocal.trim().length > 0 && responsavelLocal.trim().length < 3 && (
            <p className="text-xs text-destructive">Mínimo de 3 caracteres</p>
          )}
        </div>
      </div>
    </div>
  );
};