import React from 'react';
import { ListChecks } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface StepAcoesProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

const MAX_CHARS = 1000;
const MIN_CHARS = 50;

export const StepAcoes: React.FC<StepAcoesProps> = ({ value, onChange, onValidationChange }) => {
  const charCount = value.length;
  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;

  React.useEffect(() => {
    onValidationChange(isValid);
  }, [isValid, onValidationChange]);

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <ListChecks className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">⚙️ Ações Recomendadas</h3>
        <p className="text-muted-foreground">
          Liste de 3 a 5 <strong>ações práticas</strong>
        </p>
      </div>

      <div className="space-y-2 max-w-2xl mx-auto">
        <Label htmlFor="acoes">Ações Recomendadas</Label>
        <Textarea
          id="acoes"
          placeholder='Exemplo: "1. Reforçar treinamento das avaliadoras. 2. Revisar critérios de aceitação. 3. Agendar reunião de alinhamento com consultoria."'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          maxLength={MAX_CHARS}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {charCount < MIN_CHARS && `Mínimo: ${MIN_CHARS} caracteres`}
            {charCount >= MIN_CHARS && charCount <= MAX_CHARS && '✓ Válido'}
            {charCount > MAX_CHARS && 'Máximo excedido'}
          </span>
          <span className={charCount > MAX_CHARS ? 'text-destructive' : ''}>
            {charCount} / {MAX_CHARS}
          </span>
        </div>
      </div>
    </div>
  );
};