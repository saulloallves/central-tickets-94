// DEPRECATED: This component is no longer needed - OneSignal handles push prompts natively
// Keeping for backwards compatibility only
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { useOneSignal } from '@/hooks/useOneSignal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const PushNotificationPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const { isInitialized, isSubscribed, promptSubscription, unsubscribe } = useOneSignal();

  useEffect(() => {
    // OneSignal handles everything - hide if already subscribed
    if (isSubscribed) {
      setShowPrompt(false);
    }
  }, [isSubscribed]);

  const handleSubscribe = async () => {
    await promptSubscription();
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  // OneSignal handles everything - this component is deprecated
  if (!isInitialized) {
    return null;
  }

  return (
    <>
      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Ativar Notificações Push?
            </DialogTitle>
            <DialogDescription>
              Receba notificações instantâneas sobre novos tickets, alertas de SLA e atualizações importantes diretamente no seu navegador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleDismiss}>
              Agora não
            </Button>
            <Button onClick={handleSubscribe}>
              Ativar Notificações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botão de controle sempre visível */}
      <Button
        onClick={() => isSubscribed ? unsubscribe() : promptSubscription()}
        variant={isSubscribed ? "secondary" : "default"}
        size="sm"
        className="gap-2"
      >
        <Bell className="h-4 w-4" />
        {isSubscribed ? 'Push ativo' : 'Ativar push'}
      </Button>
    </>
  );
};
