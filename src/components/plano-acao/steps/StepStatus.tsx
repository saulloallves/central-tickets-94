import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepStatusProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

const statusOptions = [
  { 
    value: 'Crítico', 
    label: 'Crítico', 
    emoji: '🔴',
    description: 'impacta resultado ou imagem',
    color: 'border-red-500 hover:bg-red-500/10 data-[selected=true]:bg-red-500/20 data-[selected=true]:border-red-500'
  },
  { 
    value: 'Moderado', 
    label: 'Moderado', 
    emoji: '🟠',
    description: 'necessita acompanhamento ativo',
    color: 'border-orange-500 hover:bg-orange-500/10 data-[selected=true]:bg-orange-500/20 data-[selected=true]:border-orange-500'
  },
  { 
    value: 'Leve', 
    label: 'Leve', 
    emoji: '🟢',
    description: 'observação preventiva',
    color: 'border-green-500 hover:bg-green-500/10 data-[selected=true]:bg-green-500/20 data-[selected=true]:border-green-500'
  },
];

export const StepStatus: React.FC<StepStatusProps> = ({ value, onChange, onValidationChange }) => {
  React.useEffect(() => {
    onValidationChange(value.length > 0);
  }, [value, onValidationChange]);

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <AlertCircle className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">📊 Status Inicial</h3>
        <p className="text-muted-foreground">
          Qual é o <strong>status atual da situação?</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {statusOptions.map((status) => (
          <button
            key={status.value}
            type="button"
            onClick={() => onChange(status.value)}
            data-selected={value === status.value}
            className={cn(
              "p-6 border-2 rounded-lg text-center transition-all",
              status.color,
              value === status.value && "ring-2 ring-offset-2"
            )}
          >
            <div className="space-y-2">
              <span className="text-4xl block">{status.emoji}</span>
              <p className="font-bold text-lg">{status.label}</p>
              <p className="text-xs text-muted-foreground">{status.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};