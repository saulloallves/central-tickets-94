import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, Loader2 } from 'lucide-react';
import { useCreateInternalNotification } from '@/hooks/useCreateInternalNotification';
import { useAuth } from '@/hooks/useAuth';

export const TestPushNotificationButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const createNotification = useCreateInternalNotification();
  const { user } = useAuth();

  const handleTestPush = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await createNotification.mutateAsync({
        title: '🧪 Teste de Push Notification',
        message: 'Esta é uma notificação de teste enviada em ' + new Date().toLocaleTimeString('pt-BR'),
        type: 'info',
        recipients: [user.id],
        payload: {
          test: true,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleTestPush}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Enviando...
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" />
          Testar Push Notification
        </>
      )}
    </Button>
  );
};
