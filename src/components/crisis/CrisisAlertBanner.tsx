
import { useState, useEffect } from 'react';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCrisisManagement } from '@/hooks/useCrisisManagement';
import { cn } from '@/lib/utils';

export const CrisisAlertBanner = () => {
  const { activeCrises, loading } = useCrisisManagement();
  const [isMinimized, setIsMinimized] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);

  // Reset audio played state when crises list changes
  useEffect(() => {
    if (activeCrises.length === 0) {
      setAudioPlayed(false);
      setIsMinimized(false);
    }
  }, [activeCrises.length]);

  // Play crisis alert sound
  useEffect(() => {
    if (activeCrises.length > 0 && !audioPlayed) {
      // Create a more attention-grabbing sound sequence
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (frequency: number, duration: number, delay: number = 0) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
          
          oscillator.start();
          oscillator.stop(audioContext.currentTime + duration);
        }, delay);
      };

      // Crisis alert pattern: 3 ascending beeps
      playBeep(800, 0.2, 0);
      playBeep(1000, 0.2, 300);
      playBeep(1200, 0.3, 600);
      
      setAudioPlayed(true);
    }
  }, [activeCrises.length, audioPlayed]);

  if (loading || activeCrises.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      isMinimized ? "h-12" : "min-h-16"
    )}>
      <div className={cn(
        "bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white shadow-2xl animate-pulse",
        "border-b-4 border-red-700"
      )}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 animate-bounce" />
                <span className="font-bold text-lg">🚨 MODO CRISE ATIVO</span>
                <Badge variant="destructive" className="bg-white text-red-600 font-bold">
                  {activeCrises.length} CRISE{activeCrises.length > 1 ? 'S' : ''}
                </Badge>
              </div>
              
              {!isMinimized && (
                <div className="text-sm opacity-90">
                  Resposta imediata necessária • SLA: 5 minutos
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isMinimized && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-red-700"
                  onClick={() => window.open('/admin/tickets?crisis=active', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Ver Crises
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-red-700"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? '▼' : '▲'}
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <div className="mt-3 space-y-2">
              {activeCrises.slice(0, 3).map((crisis) => (
                <div key={crisis.id} className="bg-red-700/30 rounded p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">
                        {crisis.tickets?.codigo_ticket} - {crisis.tickets?.unidades?.grupo}
                      </span>
                      <span className="mx-2">•</span>
                      <span>{crisis.motivo}</span>
                    </div>
                    <Badge variant="outline" className="text-white border-white">
                      {new Date(crisis.criada_em).toLocaleTimeString('pt-BR')}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {activeCrises.length > 3 && (
                <div className="text-center text-sm opacity-75">
                  +{activeCrises.length - 3} crises adicionais
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
