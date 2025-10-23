import { MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMobileConcierge } from '@/hooks/useMobileConcierge';

interface MobileConciergeButtonProps {
  codigoGrupo: string;
  idGrupoBranco: string;
}

export const MobileConciergeButton = ({ codigoGrupo, idGrupoBranco }: MobileConciergeButtonProps) => {
  const { solicitarConcierge, isLoading } = useMobileConcierge();

  const handleClick = async () => {
    await solicitarConcierge(idGrupoBranco, codigoGrupo);
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      size="lg"
      className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
      aria-label="Falar com Concierge"
    >
      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <MessageCircle className="h-6 w-6" />
      )}
    </Button>
  );
};
