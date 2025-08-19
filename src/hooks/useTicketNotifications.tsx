import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

// Extend Window interface for browser compatibility
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

interface NotificationSound {
  play: () => Promise<void>;
}

export const useTicketNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const audioRef = useRef<NotificationSound | null>(null);

  // Inicializar o som de notificação
  useEffect(() => {
    // Criar um som de notificação simples usando AudioContext
    const createNotificationSound = () => {
      return {
        play: async () => {
          try {
            // Verificar se o browser suporta AudioContext
            if (!window.AudioContext && !window.webkitAudioContext) {
              console.warn('AudioContext não suportado');
              return;
            }

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContextClass();
            
            // Criar um beep simples
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Configurar o som (frequência de 800Hz por 200ms)
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = 'sine';
            
            // Volume baixo para não ser muito intrusivo
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
          } catch (error) {
            console.warn('Erro ao reproduzir som de notificação:', error);
          }
        }
      };
    };

    audioRef.current = createNotificationSound();
  }, []);

  // Escutar novos tickets em tempo real
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('tickets-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tickets'
        },
        (payload) => {
          const newTicket = payload.new as any;
          
          // Não tocar som se o ticket foi criado pelo próprio usuário
          if (newTicket.criado_por === user.id) {
            return;
          }

          // Tocar som de notificação
          if (audioRef.current) {
            audioRef.current.play();
          }

          // Mostrar toast de notificação
          toast({
            title: "Novo Ticket Recebido",
            description: newTicket.titulo || newTicket.descricao_problema || `${newTicket.categoria || 'Categoria não definida'}`,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  // Função para testar o som manualmente
  const testNotificationSound = async () => {
    if (audioRef.current) {
      await audioRef.current.play();
    }
  };

  return {
    testNotificationSound
  };
};