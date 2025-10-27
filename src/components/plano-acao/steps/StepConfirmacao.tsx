import React, { useEffect } from 'react';
import { CheckCircle2, Building2, User, Calendar, AlertCircle } from 'lucide-react';

interface StepConfirmacaoProps {
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
  unidadeNome?: string;
  onValidationChange: (isValid: boolean) => void;
}

export const StepConfirmacao: React.FC<StepConfirmacaoProps> = ({ formData, registroGerado, unidadeNome, onValidationChange }) => {
  useEffect(() => {
    // Step de confirmação é sempre válido pois o usuário já preencheu todos os dados
    onValidationChange(true);
  }, [onValidationChange]);
  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-green-500/10 rounded-full">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <h3 className="text-xl font-bold">📜 Confirmação Final</h3>
        <p className="text-muted-foreground">
          Revise todas as informações antes de enviar
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Resumo dos Dados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" />
              <span>Unidade</span>
            </div>
            <p className="text-sm">{unidadeNome || formData.codigo_grupo}</p>
          </div>

          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-primary" />
              <span>Responsável</span>
            </div>
            <p className="text-sm">{formData.nome_completo}</p>
            <p className="text-xs text-muted-foreground">{formData.setor}</p>
          </div>

          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4 text-primary" />
              <span>Categoria & Status</span>
            </div>
            <p className="text-sm">{formData.categoria}</p>
            <p className="text-xs text-muted-foreground">{formData.status}</p>
          </div>

          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Prazo</span>
            </div>
            <p className="text-sm">{new Date(formData.prazo).toLocaleDateString('pt-BR')}</p>
            <p className="text-xs text-muted-foreground">{formData.responsavel_local}</p>
          </div>
        </div>

        {/* Registro Formatado */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2">
            <h4 className="text-sm font-medium">Registro Completo</h4>
          </div>
          <div className="p-6 bg-card prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-sm">{registroGerado}</div>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Tudo pronto para enviar
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Ao confirmar, o plano de ação será criado e notificações serão enviadas automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};