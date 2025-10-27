import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProgressIndicator } from './ProgressIndicator';
import { NavigationButtons } from './NavigationButtons';
import { StepWelcome } from './steps/StepWelcome';
import { StepUnidade } from './steps/StepUnidade';
import { StepResponsavel } from './steps/StepResponsavel';
import { StepTipo } from './steps/StepTipo';
import { StepContexto } from './steps/StepContexto';
import { StepAcoes } from './steps/StepAcoes';
import { StepStatus } from './steps/StepStatus';
import { StepPrazos } from './steps/StepPrazos';
import { StepAnexos } from './steps/StepAnexos';
import { StepRevisaoIA } from './steps/StepRevisaoIA';
import { StepConfirmacao } from './steps/StepConfirmacao';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CreatePlanoAcaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

interface FormData {
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
  registroGerado: string;
  unidadeNome?: string;
}

export const CreatePlanoAcaoDialog: React.FC<CreatePlanoAcaoDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<FormData>({
    codigo_grupo: '',
    nome_completo: '',
    setor: '',
    categoria: '',
    descricao: '',
    acoes: '',
    status: '',
    prazo: '',
    responsavel_local: '',
    upload: '',
    registroGerado: '',
    unidadeNome: '',
  });
  const [validations, setValidations] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  const totalSteps = 11;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleValidationChange = (step: number, isValid: boolean) => {
    setValidations((prev) => ({ ...prev, [step]: isValid }));
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      codigo_grupo: '',
      nome_completo: '',
      setor: '',
      categoria: '',
      descricao: '',
      acoes: '',
      status: '',
      prazo: '',
      responsavel_local: '',
      upload: '',
      registroGerado: '',
      unidadeNome: '',
    });
    setValidations({});
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Gerar título automaticamente
      const titulo = `${formData.categoria} - ${formData.codigo_grupo}`;

      const { data, error } = await supabase.functions.invoke('create-plano-acao', {
        body: {
          codigo_grupo: formData.codigo_grupo,
          titulo,
          descricao: formData.descricao,
          acoes: formData.acoes,
          status: formData.status,
          prazo: formData.prazo,
          responsavel_local: formData.responsavel_local,
          categoria: formData.categoria,
          gpt: formData.registroGerado,
          nome_completo: formData.nome_completo,
          setor: formData.setor,
          upload: formData.upload || '',
        },
      });

      if (error) {
        console.error('Erro ao criar plano:', error);
        toast({
          title: 'Erro ao criar plano',
          description: error.message || 'Tente novamente',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Plano de ação criado!',
        description: 'O plano foi criado com sucesso e notificações foram enviadas.',
      });

      handleClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Erro ao criar plano:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o plano de ação',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = validations[currentStep] ?? false;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepWelcome onNext={handleNext} onCancel={handleClose} />;
      
      case 2:
        return (
          <StepUnidade
            value={formData.codigo_grupo}
            onChange={(value) => setFormData((prev) => ({ ...prev, codigo_grupo: value }))}
            onValidationChange={(isValid) => handleValidationChange(2, isValid)}
          />
        );
      
      case 3:
        return (
          <StepResponsavel
            nomeCompleto={formData.nome_completo}
            setor={formData.setor}
            onNomeChange={(value) => setFormData((prev) => ({ ...prev, nome_completo: value }))}
            onSetorChange={(value) => setFormData((prev) => ({ ...prev, setor: value }))}
            onValidationChange={(isValid) => handleValidationChange(3, isValid)}
          />
        );
      
      case 4:
        return (
          <StepTipo
            value={formData.categoria}
            onChange={(value) => setFormData((prev) => ({ ...prev, categoria: value }))}
            onValidationChange={(isValid) => handleValidationChange(4, isValid)}
          />
        );
      
      case 5:
        return (
          <StepContexto
            value={formData.descricao}
            onChange={(value) => setFormData((prev) => ({ ...prev, descricao: value }))}
            onValidationChange={(isValid) => handleValidationChange(5, isValid)}
          />
        );
      
      case 6:
        return (
          <StepAcoes
            value={formData.acoes}
            onChange={(value) => setFormData((prev) => ({ ...prev, acoes: value }))}
            onValidationChange={(isValid) => handleValidationChange(6, isValid)}
          />
        );
      
      case 7:
        return (
          <StepStatus
            value={formData.status}
            onChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
            onValidationChange={(isValid) => handleValidationChange(7, isValid)}
          />
        );
      
      case 8:
        return (
          <StepPrazos
            prazo={formData.prazo}
            responsavelLocal={formData.responsavel_local}
            onPrazoChange={(value) => setFormData((prev) => ({ ...prev, prazo: value }))}
            onResponsavelChange={(value) => setFormData((prev) => ({ ...prev, responsavel_local: value }))}
            onValidationChange={(isValid) => handleValidationChange(8, isValid)}
          />
        );
      
      case 9:
        return (
          <StepAnexos
            value={formData.upload || ''}
            onChange={(value) => setFormData((prev) => ({ ...prev, upload: value }))}
          />
        );
      
      case 10:
        return (
          <StepRevisaoIA
            formData={formData}
            registroGerado={formData.registroGerado}
            onRegistroChange={(value) => setFormData((prev) => ({ ...prev, registroGerado: value }))}
            onValidationChange={(isValid) => handleValidationChange(10, isValid)}
          />
        );
      
      case 11:
        return (
          <StepConfirmacao
            formData={formData}
            registroGerado={formData.registroGerado}
            unidadeNome={formData.unidadeNome}
            onValidationChange={(isValid) => handleValidationChange(11, isValid)}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Plano de Ação Operacional</DialogTitle>
        </DialogHeader>

        {currentStep > 1 && (
          <ProgressIndicator currentStep={currentStep} totalSteps={totalSteps} />
        )}

        <div className="min-h-[400px]">
          {renderStep()}
        </div>

        {currentStep !== 1 && (
          <NavigationButtons
            onBack={handleBack}
            onNext={currentStep < totalSteps ? handleNext : handleSubmit}
            nextLabel={currentStep === 11 ? 'Confirmar e Enviar' : currentStep === 9 ? 'Pular' : 'Próximo'}
            nextDisabled={currentStep !== 9 && !isStepValid}
            loading={loading}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};