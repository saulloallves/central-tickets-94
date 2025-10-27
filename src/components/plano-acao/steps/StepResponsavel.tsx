import React from 'react';
import { User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StepResponsavelProps {
  nomeCompleto: string;
  setor: string;
  onNomeChange: (value: string) => void;
  onSetorChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

const setores = [
  'Consultoria',
  'Operações',
  'Financeiro',
  'Expansão',
  'Jurídico',
  'RH',
  'Outros'
];

export const StepResponsavel: React.FC<StepResponsavelProps> = ({
  nomeCompleto,
  setor,
  onNomeChange,
  onSetorChange,
  onValidationChange,
}) => {
  React.useEffect(() => {
    const isValid = nomeCompleto.trim().length >= 3 && setor.length > 0;
    onValidationChange(isValid);
  }, [nomeCompleto, setor, onValidationChange]);

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <User className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">👤 Responsável pelo Registro</h3>
        <p className="text-muted-foreground">
          Informe seu <strong>nome completo</strong> e <strong>setor responsável</strong>
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="nome_completo">Nome Completo</Label>
          <Input
            id="nome_completo"
            type="text"
            placeholder="Seu nome completo"
            value={nomeCompleto}
            onChange={(e) => onNomeChange(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="setor">Setor</Label>
          <Select value={setor} onValueChange={onSetorChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione seu setor" />
            </SelectTrigger>
            <SelectContent>
              {setores.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};