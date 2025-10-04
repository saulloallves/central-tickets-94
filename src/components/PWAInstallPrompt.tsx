import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Verificar se já está instalado
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    if (isInstalled) return;

    // Verificar se usuário já recusou
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    // Listener para evento beforeinstallprompt (Chrome/Edge)
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Mostrar prompt para iOS após 5 segundos (não tem beforeinstallprompt)
    if (iOS && !isInstalled) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('PWA instalado');
    }

    setInstallPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">
              Instalar Central de Tickets
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {isIOS 
                ? 'Toque no ícone de compartilhar e depois em "Adicionar à Tela de Início"'
                : 'Instale nosso app para acesso rápido e offline'
              }
            </p>
            
            {!isIOS && (
              <Button
                onClick={handleInstall}
                className="w-full"
                size="sm"
              >
                Instalar Agora
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
