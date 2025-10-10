import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';

export const AutoCacheCleaner = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const INACTIVITY_TIME = 10 * 60 * 1000; // 10 minutos
  const WARNING_TIME = 30 * 1000; // 30 segundos antes

  const clearAllTimers = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const clearCacheAndReload = async () => {
    try {
      console.log('🧹 Auto-limpeza de cache iniciada...');
      
      // Limpar caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Desregistrar Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      console.log('✅ Cache limpo, recarregando...');
      window.location.reload();
    } catch (error) {
      console.error('❌ Erro ao limpar cache:', error);
      window.location.reload();
    }
  };

  const startWarning = () => {
    setShowWarning(true);
    setCountdown(30);

    // Countdown visual
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearCacheAndReload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Timer final
    warningTimerRef.current = setTimeout(() => {
      clearCacheAndReload();
    }, WARNING_TIME);
  };

  const cancelReload = () => {
    console.log('🚫 Recarregamento cancelado pelo usuário');
    clearAllTimers();
    setShowWarning(false);
    resetInactivityTimer();
    
    toast({
      title: "Recarregamento cancelado",
      description: "O timer foi reiniciado",
    });
  };

  const resetInactivityTimer = () => {
    clearAllTimers();
    setShowWarning(false);

    // Timer principal (10 minutos)
    inactivityTimerRef.current = setTimeout(() => {
      startWarning();
    }, INACTIVITY_TIME);
  };

  useEffect(() => {
    // Eventos de atividade do usuário
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      if (!showWarning) {
        resetInactivityTimer();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Iniciar timer
    resetInactivityTimer();

    return () => {
      clearAllTimers();
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [showWarning]);

  if (!showWarning) return null;

  return (
    <Card className="fixed bottom-6 right-6 w-96 shadow-lg border-orange-500/30 z-50 animate-in slide-in-from-bottom-5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCw className="h-5 w-5 text-orange-500 animate-spin" />
          Limpeza Automática de Cache
        </CardTitle>
        <CardDescription>
          A página será atualizada em <strong>{countdown}s</strong> para limpar o cache
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button 
            onClick={cancelReload} 
            variant="outline"
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={clearCacheAndReload}
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar Agora
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
