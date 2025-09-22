import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInternalNotifications } from '@/hooks/useInternalNotifications';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

/**
 * Componente global para escutar notificações em tempo real
 * Deve ser incluído no App.tsx para funcionar em todas as rotas
 */
export const GlobalNotificationListener = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Escuta notificações internas (internal_notifications)
  const { unreadCount } = useInternalNotifications();
  
  // Escuta notificações da fila e SLAs
  useRealtimeNotifications();

  // Sistema de notificações em tempo real DIRETO no componente
  useEffect(() => {
    if (!user?.id) {
      console.log('🔔 📴 Usuario não logado - notificações desabilitadas');
      return;
    }

    console.log('🔔 🚀 SISTEMA REALTIME INICIADO PARA:', user.id);
    console.log('🔔 📡 Configurando escuta DIRETA no GlobalListener...');

    // Canal principal para notificações internas
    const directChannel = supabase
      .channel(`direct-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_notification_recipients',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('🔔 💥 NOTIFICAÇÃO DIRETA RECEBIDA!', payload);
          
          try {
            // Buscar detalhes da notificação
            const { data: notification } = await supabase
              .from('internal_notifications')
              .select('*')
              .eq('id', payload.new.notification_id)
              .single();

            if (notification) {
              console.log('🔔 ✅ Processando notificação direta:', notification);
              
              if (notification.type === 'franqueado_respondeu') {
                toast({
                  title: "💬 Franqueado Respondeu!",
                  description: notification.message || "Nova resposta recebida",
                  duration: 6000,
                });
                
                // Som
                try {
                  const audio = new Audio('/notification-sound.mp3');
                  audio.volume = 0.8;
                  audio.play().catch(e => console.log('🔔 ❌ Erro som:', e));
                } catch (e) {
                  console.log('🔔 ❌ Erro audio:', e);
                }
              } else {
                toast({
                  title: "🔔 Nova Notificação",
                  description: notification.title || notification.message || "Você tem uma nova notificação",
                  duration: 5000,
                });
              }
            }
          } catch (error) {
            console.error('🔔 ❌ Erro ao processar notificação direta:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 📡 STATUS CANAL DIRETO:', status);
        if (status === 'SUBSCRIBED') {
          console.log('🔔 ✅ CANAL DIRETO CONECTADO!');
        } else if (status === 'CLOSED') {
          console.log('🔔 ❌ CANAL DIRETO PERDIDO!');
        }
      });

    return () => {
      console.log('🔔 🧹 Limpando canal direto para:', user.id);
      supabase.removeChannel(directChannel);
    };
  }, [user?.id, toast]);

  useEffect(() => {
    if (user) {
      console.log('🌐 GlobalNotificationListener ativo para usuário:', user.id);
      console.log('🔔 Notificações não lidas:', unreadCount);
    }
  }, [user?.id, unreadCount]);

  // Componente invisível - apenas executa os hooks em background
  return null;
};