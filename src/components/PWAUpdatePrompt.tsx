import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const PWAUpdatePrompt = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('✅ SW Registered:', r);
    },
    onRegisterError(error) {
      console.error('❌ SW registration error:', error);
    },
  });

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  // Don't show if no update is needed
  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 shadow-lg border-primary/20 z-50 animate-in slide-in-from-bottom-5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCw className="h-5 w-5 text-primary" />
          {needRefresh ? 'Nova Atualização Disponível' : 'App Pronto para Usar Offline'}
        </CardTitle>
        <CardDescription>
          {needRefresh 
            ? 'Uma nova versão do aplicativo está disponível. Recarregue para atualizar.' 
            : 'O aplicativo está pronto para funcionar offline.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          {needRefresh && (
            <Button 
              onClick={handleUpdate} 
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recarregar Agora
            </Button>
          )}
          <Button 
            onClick={handleDismiss} 
            variant="outline"
          >
            {needRefresh ? 'Depois' : 'OK'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
