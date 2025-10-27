import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface StepRevisaoIAProps {
  formData: {
    codigo_grupo: string;
    nome_completo: string;
    setor: string;
    categoria: string;
    descricao: string;
    acoes: string;
    status: string;
    prazo: string;
    responsavel_local: string;
    upload?: string;
  };
  registroGerado: string;
  onRegistroChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

export const StepRevisaoIA: React.FC<StepRevisaoIAProps> = ({
  formData,
  registroGerado,
  onRegistroChange,
  onValidationChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!registroGerado && !loading) {
      generateRegistro();
    }
  }, []);

  useEffect(() => {
    onValidationChange(registroGerado.length > 0);
  }, [registroGerado, onValidationChange]);

  const generateRegistro = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-registro-ia', {
        body: {
          codigo_grupo: formData.codigo_grupo,
          nome_completo: formData.nome_completo,
          setor: formData.setor,
          acompanhamento: formData.categoria,
          descricao: formData.descricao,
          acoes: formData.acoes,
          status: formData.status,
          prazo: formData.prazo,
          responsavel_local: formData.responsavel_local,
          upload: formData.upload || '',
        },
      });

      if (error) {
        console.error('Erro ao gerar registro:', error);
        toast({
          title: 'Erro ao gerar registro',
          description: error.message || 'Tente novamente mais tarde',
          variant: 'destructive',
        });
        return;
      }

      if (data?.registro) {
        onRegistroChange(data.registro);
      }
    } catch (error) {
      console.error('Erro ao chamar edge function:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar o registro',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">🧠 Revisão Automática (IA)</h3>
        <p className="text-muted-foreground">
          A IA está gerando o <strong>registro completo</strong> baseado nas suas informações
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gerando registro profissional...</p>
          </div>
        ) : registroGerado ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Registro Gerado</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {editMode ? 'Visualizar' : 'Editar'}
              </Button>
            </div>

            {editMode ? (
              <Textarea
                value={registroGerado}
                onChange={(e) => onRegistroChange(e.target.value)}
                rows={20}
                className="font-mono text-sm"
              />
            ) : (
              <div className="p-6 border rounded-lg bg-muted/30 prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap">{registroGerado}</div>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Registro gerado automaticamente pela IA. Você pode editar antes de confirmar.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Erro ao gerar registro</p>
            <Button onClick={generateRegistro}>
              Tentar Novamente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};