import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface StepResponsavelProps {
  nomeCompleto: string;
  setor: string;
  onNomeChange: (value: string) => void;
  onSetorChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

interface Equipe {
  id: string;
  nome: string;
}

export const StepResponsavel: React.FC<StepResponsavelProps> = ({
  nomeCompleto,
  setor,
  onNomeChange,
  onSetorChange,
  onValidationChange,
}) => {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEquipes = async () => {
      const { data, error } = await supabase
        .from('equipes')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (!error && data) {
        setEquipes(data);
      }
      setLoading(false);
    };

    fetchEquipes();
  }, []);

  useEffect(() => {
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
            Informe seu <strong>nome completo</strong> e <strong>equipe responsável</strong>
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
          <Label htmlFor="setor">Equipe</Label>
          <Select value={setor} onValueChange={onSetorChange} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Carregando equipes..." : "Selecione sua equipe"} />
            </SelectTrigger>
            <SelectContent>
              {equipes.map((equipe) => (
                <SelectItem key={equipe.id} value={equipe.nome}>
                  {equipe.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};