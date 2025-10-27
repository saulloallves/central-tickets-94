import React from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepTipoProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

const tipos = [
  { value: 'Operacional', label: 'Operacional', emoji: '🧮', description: 'avaliações, compras, desempenho' },
  { value: 'Relacionamento', label: 'Relacionamento', emoji: '💬', description: 'comunicação, postura, equipe' },
  { value: 'Financeiro', label: 'Financeiro', emoji: '💰', description: 'royalties, inadimplência, relatórios' },
  { value: 'Jurídico / Contratual', label: 'Jurídico / Contratual', emoji: '⚖️', description: 'questões legais e contratuais' },
  { value: 'Expansão / Inauguração', label: 'Expansão / Inauguração', emoji: '🌱', description: 'novos projetos e inaugurações' },
  { value: 'RH / Equipe', label: 'RH / Equipe', emoji: '🧑‍💼', description: 'gestão de pessoas' },
];

export const StepTipo: React.FC<StepTipoProps> = ({ value, onChange, onValidationChange }) => {
  React.useEffect(() => {
    onValidationChange(value.length > 0);
  }, [value, onValidationChange]);

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Layers className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">🧩 Tipo de Registro</h3>
        <p className="text-muted-foreground">
          Qual é o tipo de acompanhamento que originou este plano?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
        {tipos.map((tipo) => (
          <button
            key={tipo.value}
            type="button"
            onClick={() => onChange(tipo.value)}
            className={cn(
              "p-4 border rounded-lg text-left transition-all hover:border-primary hover:bg-primary/5",
              value === tipo.value && "border-primary bg-primary/10 ring-2 ring-primary"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{tipo.emoji}</span>
              <div className="flex-1 space-y-1">
                <p className="font-medium">{tipo.label}</p>
                <p className="text-xs text-muted-foreground">{tipo.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};