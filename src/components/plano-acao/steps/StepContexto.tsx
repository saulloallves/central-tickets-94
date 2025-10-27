import React from 'react';
import { FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface StepContextoProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

const MAX_CHARS = 1000;
const MIN_CHARS = 50;

export const StepContexto: React.FC<StepContextoProps> = ({ value, onChange, onValidationChange }) => {
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
            <FileText className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">📋 Contexto da Situação</h3>
        <p className="text-muted-foreground">
          Descreva brevemente o <strong>contexto do problema ou observação</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          Dê exemplos concretos, datas e frequência, se possível.
        </p>
      </div>

      <div className="space-y-2 max-w-2xl mx-auto">
        <Label htmlFor="contexto">Descrição do Contexto</Label>
        <Textarea
          id="contexto"
          placeholder='Exemplo: "Unidade vem apresentando baixo aproveitamento de avaliações há três semanas consecutivas. Avaliadoras estão recusando lotes sem justificativa comercial."'
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