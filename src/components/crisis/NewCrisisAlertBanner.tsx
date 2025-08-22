
import { useState, useEffect } from 'react';
import { AlertTriangle, X, ExternalLink, MessageSquare, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNewCrisisManagement } from '@/hooks/useNewCrisisManagement';
import { cn } from '@/lib/utils';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';

export const NewCrisisAlertBanner = () => {
  const { activeCrises, loading } = useNewCrisisManagement();
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-red-600';
      case 'investigando': return 'bg-orange-600';
      case 'comunicado': return 'bg-blue-600';
      case 'mitigado': return 'bg-yellow-600';
      default: return 'bg-red-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aberto': return 'ABERTA';
      case 'investigando': return 'INVESTIGANDO';
      case 'comunicado': return 'COMUNICADA';
      case 'mitigado': return 'MITIGADA';
      case 'reaberto': return 'REABERTA';
      default: return status.toUpperCase();
    }
  };

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
                  Gestão centralizada de incidentes • Múltiplos tickets agrupados
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
            <div className="mt-3">
              <div className="bg-red-700/30 rounded p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className="text-white border-white text-xs bg-red-600"
                      >
                        ATIVA
                      </Badge>
                      <span className="font-medium">
                        {activeCrises.length === 1 
                          ? activeCrises[0].titulo 
                          : `${activeCrises.length} crises simultâneas`
                        }
                      </span>
                    </div>
                    
                    <div className="text-xs opacity-75">
                      {activeCrises.reduce((total, crisis) => 
                        total + (crisis.crise_ticket_links?.length || 0), 0
                      )} tickets afetados
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-red-600 text-xs"
                    onClick={() => {
                      const crisisPanel = document.querySelector('[data-crisis-panel-trigger]');
                      if (crisisPanel) {
                        (crisisPanel as HTMLElement).click();
                      }
                    }}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Ver Detalhes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
