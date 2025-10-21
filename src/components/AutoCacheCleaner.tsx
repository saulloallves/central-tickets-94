import { useEffect, useRef } from 'react';

export const AutoCacheCleaner = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearCacheAndReload = async () => {
    try {
      console.log('🧹 Limpeza automática de cache (3 horas)');
      
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
      console.error('❌ Erro na limpeza automática:', error);
      window.location.reload();
    }
  };

  useEffect(() => {
    const THREE_HOURS = 3 * 60 * 60 * 1000; // 3 horas em ms
    
    console.log('⏰ Timer de limpeza automática iniciado: 3 horas');
    
    timerRef.current = setTimeout(() => {
      clearCacheAndReload();
    }, THREE_HOURS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return null;
};
