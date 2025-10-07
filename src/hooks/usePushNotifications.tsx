import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const VAPID_PUBLIC_KEY = 'BI8h31LsdcURuFceGqNbPESJHKQMEk_ZGCp_z7Q6VusQIg7zADtOYSSjIQDW_TYyAnyXNQF72fqIP4bGm5B5sVI';

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);

      if (supported) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    };

    checkSupport();
  }, []);

  const subscribe = async () => {
    if (!isSupported) {
      toast({
        title: "Não suportado",
        description: "Seu navegador não suporta notificações push",
        variant: "destructive",
      });
      return false;
    }

    try {
      setIsLoading(true);

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          title: "Permissão negada",
          description: "Você precisa permitir notificações para recebê-las",
          variant: "destructive",
        });
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const deviceInfo = `${navigator.userAgent.substring(0, 100)}`;

      const { error } = await supabase.functions.invoke('register-push-subscription', {
        body: {
          subscription: subscription.toJSON(),
          deviceInfo,
        },
      });

      if (error) {
        console.error('Erro ao registrar subscription:', error);
        throw error;
      }

      setIsSubscribed(true);
      toast({
        title: "✅ Notificações ativadas",
        description: "Você receberá notificações push no navegador",
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao ativar notificações:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível ativar as notificações",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    try {
      setIsLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      toast({
        title: "Notificações desativadas",
        description: "Você não receberá mais notificações push",
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao desativar notificações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desativar as notificações",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
