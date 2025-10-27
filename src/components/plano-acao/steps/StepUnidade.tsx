import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

interface StepUnidadeProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

export const StepUnidade: React.FC<StepUnidadeProps> = ({ value, onChange, onValidationChange }) => {
  const [unidadeInfo, setUnidadeInfo] = useState<{ fantasy_name: string; grupo: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const validateUnidade = async () => {
      if (value.length !== 4) {
        setUnidadeInfo(null);
        setError('');
        onValidationChange(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const { data, error: dbError } = await supabase
          .from('unidades')
          .select('fantasy_name, grupo')
          .eq('codigo_grupo', value)
          .single();

        if (dbError || !data) {
          setError('Código inválido ou unidade não encontrada');
          setUnidadeInfo(null);
          onValidationChange(false);
        } else {
          setUnidadeInfo(data);
          setError('');
          onValidationChange(true);
        }
      } catch (err) {
        setError('Erro ao buscar unidade');
        setUnidadeInfo(null);
        onValidationChange(false);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(validateUnidade, 500);
    return () => clearTimeout(timer);
  }, [value, onValidationChange]);

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">🧾 Identificação da Unidade</h3>
        <p className="text-muted-foreground">
          Digite o <strong>código da unidade (4 dígitos)</strong>
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="codigo_grupo">Código da Unidade</Label>
          <div className="relative">
            <Input
              id="codigo_grupo"
              type="text"
              placeholder="0000"
              value={value}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                onChange(val);
              }}
              maxLength={4}
              className="text-center text-lg tracking-widest"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive text-center">{error}</p>
          </div>
        )}

        {unidadeInfo && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-1">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Unidade encontrada</span>
            </div>
            <p className="text-sm font-medium">
              {unidadeInfo.fantasy_name}
            </p>
            {unidadeInfo.grupo && (
              <p className="text-sm text-muted-foreground">
                Franqueado: {unidadeInfo.grupo}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};