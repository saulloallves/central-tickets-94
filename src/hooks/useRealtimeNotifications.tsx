import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export const useRealtimeNotifications = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    console.log('🔔 📡 CONFIGURANDO NOTIFICAÇÕES EM TEMPO REAL - NOTIFICATIONS QUEUE...');

    // Canal para notificações da fila
    const notificationsChannel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications_queue',
          filter: `status=eq.pending`
        },
        (payload) => {
          console.log('📱 🆕 NOVA NOTIFICAÇÃO NA FILA RECEBIDA:', payload);
          handleNotification(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications_queue',
          filter: `status=eq.processed`
        },
        (payload) => {
          console.log('✅ 📝 NOTIFICAÇÃO PROCESSADA:', payload);
          handleProcessedNotification(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('🔔 📡 STATUS NOTIFICATIONS QUEUE:', status);
        if (status === 'SUBSCRIBED') {
          console.log('🔔 ✅ NOTIFICATIONS QUEUE REALTIME CONECTADO!');
        } else if (status === 'CLOSED') {
          console.log('🔔 ❌ NOTIFICATIONS QUEUE REALTIME DESCONECTADO!');
        }
      });

    // Canal para SLAs vencidos em tickets
    const slaChannel = supabase
      .channel('sla-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `status_sla=eq.vencido`
        },
        (payload) => {
          console.log('⏰ 🚨 SLA VENCIDO DETECTADO:', payload);
          handleSLABreach(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `status=eq.escalonado`
        },
        (payload) => {
          console.log('📈 ⬆️ TICKET ESCALADO:', payload);
          handleTicketEscalation(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('🔔 📡 STATUS SLA REALTIME:', status);
        if (status === 'SUBSCRIBED') {
          console.log('🔔 ✅ SLA REALTIME CONECTADO!');
        } else if (status === 'CLOSED') {
          console.log('🔔 ❌ SLA REALTIME DESCONECTADO!');
        }
      });

    return () => {
      console.log('🔕 🧹 DESCONECTANDO NOTIFICAÇÕES EM TEMPO REAL...');
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(slaChannel);
    };
  }, [user, toast]);

  const handleNotification = (notification: any) => {
    const { type, payload, alert_level } = notification;

    switch (type) {
      case 'sla_breach':
        toast({
          title: '🚨 SLA Vencido!',
          description: `"${payload?.titulo || 'Ticket sem título'}" teve o SLA vencido e foi escalado automaticamente`,
          variant: 'destructive',
        });
        break;

      case 'sla_half':
        toast({
          title: '⚠️ SLA 50%',
          description: `"${payload?.titulo || 'Ticket sem título'}" atingiu 50% do SLA`,
          variant: 'default',
        });
        break;

      case 'crisis':
        toast({
          title: '🔥 Crise Detectada!',
          description: `Ticket ${payload?.codigo_ticket} foi marcado como crise`,
          variant: 'destructive',
        });
        break;

      case 'ticket_created':
        toast({
          title: '🎫 Novo Ticket',
          description: `Ticket ${payload?.codigo_ticket} foi criado`,
          variant: 'default',
        });
        break;

      case 'franqueado_respondeu':
        toast({
          title: '💬 Franqueado Respondeu!',
          description: `Ticket ${payload?.codigo_ticket} teve uma nova resposta`,
          variant: 'default',
        });
        // Emitir som de notificação
        try {
          const audio = new Audio('/notification-sound.mp3');
          audio.volume = 0.5;
          audio.play().catch(e => console.log('Erro ao reproduzir som:', e));
        } catch (error) {
          console.log('Erro ao criar áudio:', error);
        }
        break;

      default:
        if (alert_level === 'critical') {
          toast({
            title: '🚨 Alerta Crítico',
            description: `Nova notificação de ${type}`,
            variant: 'destructive',
          });
        }
        break;
    }
  };

  const handleProcessedNotification = (notification: any) => {
    const { type, payload } = notification;
    
    if (type === 'sla_breach') {
      toast({
        title: '📤 Notificação Enviada',
        description: `Escalamento do ticket ${payload?.codigo_ticket} foi comunicado via WhatsApp`,
        variant: 'default',
      });
    }
  };

  const handleSLABreach = (ticket: any) => {
    toast({
      title: '🚨 SLA Vencido!',
      description: `Ticket ${ticket.codigo_ticket} teve o SLA vencido`,
      variant: 'destructive',
    });
  };

  const handleTicketEscalation = (ticket: any) => {
    toast({
      title: '📈 Ticket Escalado',
      description: `Ticket ${ticket.codigo_ticket} foi escalado automaticamente (Nível ${ticket.escalonamento_nivel})`,
      variant: 'default',
    });
  };
};