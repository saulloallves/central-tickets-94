import React from 'react';
import { ClipboardCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepWelcomeProps {
  onNext: () => void;
  onCancel: () => void;
}

export const StepWelcome: React.FC<StepWelcomeProps> = ({ onNext, onCancel }) => {
  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-center">
        <div className="p-4 bg-primary/10 rounded-full">
          <ClipboardCheck className="h-12 w-12 text-primary" />
        </div>
      </div>

      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">👋 Olá, equipe!</h2>
        
        <div className="space-y-2">
          <p className="text-lg">Vamos abrir um novo</p>
          <p className="text-xl font-bold text-primary">Plano de Ação Operacional</p>
        </div>

        <p className="text-muted-foreground max-w-md mx-auto">
          Este fluxo é exclusivo para a equipe interna (Consultoria, Operações, Financeiro, Expansão, Jurídico, etc.).
        </p>

        <p className="text-lg font-medium mt-6">Vamos começar?</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
        <Button
          onClick={onNext}
          size="lg"
          className="min-w-[200px]"
        >
          🟢 Iniciar Novo Plano
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          size="lg"
          className="min-w-[200px]"
        >
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </div>
  );
};