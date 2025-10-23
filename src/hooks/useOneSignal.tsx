import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

export const useOneSignal = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isInitialized, setIsInitialized] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Não inicializar OneSignal em rotas mobile (públicas)
    if (location.pathname.startsWith('/mobile')) {
      return;
    }
    
    if (!user) return;

    // Wait for OneSignal to be ready
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        // Check if already subscribed
        const isPushSupported = await OneSignal.Notifications.isPushSupported();
        if (!isPushSupported) {
          console.log('Push notifications not supported');
          return;
        }

        const permission = await OneSignal.Notifications.permissionNative;
        setIsSubscribed(permission === 'granted');

        // Get player ID (subscription ID)
        const userId = await OneSignal.User.PushSubscription.id;
        if (userId) {
          setPlayerId(userId);
          await syncPlayerIdWithSupabase(userId);
        }

        // Listen for subscription changes
        OneSignal.User.PushSubscription.addEventListener('change', async (event: any) => {
          const newPlayerId = event.current.id;
          if (newPlayerId) {
            setPlayerId(newPlayerId);
            setIsSubscribed(true);
            await syncPlayerIdWithSupabase(newPlayerId);
          } else {
            setIsSubscribed(false);
            setPlayerId(null);
          }
        });

        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing OneSignal:', error);
      }
    });
  }, [user]);

  const syncPlayerIdWithSupabase = async (playerIdToSync: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('sync-onesignal-user', {
        body: {
          player_id: playerIdToSync,
          user_id: user.id,
        },
      });

      if (error) {
        console.error('Error syncing OneSignal player ID:', error);
      } else {
        console.log('✅ OneSignal player ID synced successfully');
      }
    } catch (error) {
      console.error('Error calling sync function:', error);
    }
  };

  const promptSubscription = async () => {
    if (!window.OneSignal) {
      toast({
        title: 'Erro',
        description: 'OneSignal não está carregado',
        variant: 'destructive',
      });
      return;
    }

    try {
      await window.OneSignal.Slidedown.promptPush();
    } catch (error) {
      console.error('Error prompting subscription:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível solicitar permissão',
        variant: 'destructive',
      });
    }
  };

  const unsubscribe = async () => {
    if (!window.OneSignal) return;

    try {
      await window.OneSignal.User.PushSubscription.optOut();
      setIsSubscribed(false);
      setPlayerId(null);
      
      toast({
        title: 'Sucesso',
        description: 'Notificações push desativadas',
      });
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível desativar notificações',
        variant: 'destructive',
      });
    }
  };

  return {
    isInitialized,
    isSubscribed,
    playerId,
    promptSubscription,
    unsubscribe,
  };
};
