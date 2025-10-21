import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, RefreshCw, Smartphone, Monitor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const PWADiagnostic = () => {
  const [isPWA, setIsPWA] = useState(false);
  const [hasServiceWorker, setHasServiceWorker] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const { toast } = useToast();

  useEffect(() => {
    // Detectar se está em modo PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsPWA(isStandalone);

    // Verificar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        setHasServiceWorker(!!registration);
        setCacheStatus('ok');
      }).catch(() => {
        setCacheStatus('error');
      });
    } else {
      setCacheStatus('error');
    }
  }, []);

  const clearCacheAndReload = async () => {
    try {
      console.log('🧹 Limpeza manual de cache iniciada...');
      
      // Limpar todos os caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Desregistrar Service Worker
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isPWA ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          Diagnóstico PWA
        </CardTitle>
        <CardDescription>
          Status da aplicação instalada
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div>
            <p className="font-medium">Modo de Exibição</p>
            <p className="text-sm text-muted-foreground">
              {isPWA ? 'Aplicativo Instalado (PWA)' : 'Navegador Web'}
            </p>
          </div>
          {isPWA ? (
            <Badge className="bg-green-500">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              PWA
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Monitor className="h-4 w-4 mr-1" />
              Web
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div>
            <p className="font-medium">Service Worker</p>
            <p className="text-sm text-muted-foreground">
              {hasServiceWorker ? 'Ativo e registrado' : 'Não registrado'}
            </p>
          </div>
          {hasServiceWorker ? (
            <Badge className="bg-green-500">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Ativo
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-4 w-4 mr-1" />
              Inativo
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
          <div>
            <p className="font-medium">Status do Cache</p>
            <p className="text-sm text-muted-foreground">
              {cacheStatus === 'checking' && 'Verificando...'}
              {cacheStatus === 'ok' && 'Cache funcionando normalmente'}
              {cacheStatus === 'error' && 'Erro ao acessar cache'}
            </p>
          </div>
          {cacheStatus === 'ok' && (
            <Badge className="bg-green-500">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              OK
            </Badge>
          )}
          {cacheStatus === 'error' && (
            <Badge variant="destructive">
              <XCircle className="h-4 w-4 mr-1" />
              Erro
            </Badge>
          )}
        </div>

        <div className="pt-4 space-y-3">
          <Button 
            onClick={clearCacheAndReload} 
            className="w-full"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Limpar Cache e Recarregar
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Use esta opção se estiver enfrentando problemas com ícones, animações ou layout após atualizar o app.
          </p>
        </div>

        {isPWA && (
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
              💡 Dica: Ícones do PWA
            </p>
            <p className="text-xs text-muted-foreground">
              Se o ícone do app não atualizar no Windows:
            </p>
            <ol className="text-xs text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
              <li>Desinstale o aplicativo (Configurações → Apps)</li>
              <li>Clique em "Limpar Cache e Recarregar" acima</li>
              <li>Reinstale o aplicativo</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
