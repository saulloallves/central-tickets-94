import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
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
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();

  useEffect(() => {
    // Apenas mostrar prompt se não estiver inscrito e não tiver sido mostrado antes
    if (isSupported && !isSubscribed) {
      const hasShownBefore = localStorage.getItem('push-prompt-shown');
      if (!hasShownBefore) {
        const timer = setTimeout(() => {
          setShowPrompt(true);
          localStorage.setItem('push-prompt-shown', 'true');
        }, 5000);
        
        return () => clearTimeout(timer);
      }
    } else if (isSubscribed) {
      // Se já está inscrito, garantir que o prompt está fechado
      setShowPrompt(false);
    }
  }, [isSupported, isSubscribed]);

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Mostrar novamente em 24h
    setTimeout(() => {
      localStorage.removeItem('push-prompt-shown');
    }, 24 * 60 * 60 * 1000);
  };

  if (!isSupported) {
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
            <Button onClick={handleSubscribe} disabled={isLoading}>
              {isLoading ? 'Ativando...' : 'Ativar Notificações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botão de controle sempre visível */}
      <Button
        variant="ghost"
        size="sm"
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading}
        className="gap-2"
      >
        {isSubscribed ? (
          <>
            <Bell className="h-4 w-4" />
            Push ativo
          </>
        ) : (
          <>
            <BellOff className="h-4 w-4" />
            Ativar push
          </>
        )}
      </Button>
    </>
  );
};
