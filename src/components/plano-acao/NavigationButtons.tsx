import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavigationButtonsProps {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  hideBack?: boolean;
  hideNext?: boolean;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  onBack,
  onNext,
  nextLabel = 'Próximo',
  backLabel = 'Voltar',
  nextDisabled = false,
  loading = false,
  hideBack = false,
  hideNext = false,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t">
      {!hideBack && onBack ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {backLabel}
        </Button>
      ) : (
        <div />
      )}

      {!hideNext && onNext && (
        <Button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              {nextLabel}
              <ChevronRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      )}
    </div>
  );
};