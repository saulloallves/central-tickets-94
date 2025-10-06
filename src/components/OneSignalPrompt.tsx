import { useEffect, useState } from 'react';
import { useOneSignal } from '@/hooks/useOneSignal';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const OneSignalPrompt = () => {
  const { isInitialized, isSubscribed, promptSubscription } = useOneSignal();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Reset dismissed state if user becomes unsubscribed
    if (!isSubscribed) {
      const dismissed = localStorage.getItem('onesignal-prompt-dismissed');
      setIsDismissed(dismissed === 'true');
    }
  }, [isSubscribed]);

  const handleActivate = async () => {
    console.log('🔔 Ativando notificações push...');
    await promptSubscription();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('onesignal-prompt-dismissed', 'true');
  };

  // Don't show if OneSignal is not initialized, user is already subscribed, or user dismissed
  if (!isInitialized || isSubscribed || isDismissed) {
    return null;
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 shadow-lg border-primary/20 z-50 animate-in slide-in-from-bottom-5">
      <CardHeader className="relative pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" />
          Ativar Notificações Push
        </CardTitle>
        <CardDescription>
          Receba atualizações em tempo real sobre tickets, SLAs e alertas importantes
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button 
            onClick={handleActivate} 
            className="flex-1"
          >
            <Bell className="w-4 h-4 mr-2" />
            Ativar Agora
          </Button>
          <Button 
            onClick={handleDismiss} 
            variant="outline"
          >
            Depois
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
