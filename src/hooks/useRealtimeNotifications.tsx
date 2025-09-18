import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export const useRealtimeNotifications = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    console.log('🔔 Configurando notificações em tempo real...');

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
          console.log('📱 Nova notificação recebida:', payload);
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
          console.log('✅ Notificação processada:', payload);
          handleProcessedNotification(payload.new);
        }
      )
      .subscribe();

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
          console.log('⏰ SLA vencido detectado:', payload);
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
          console.log('📈 Ticket escalado:', payload);
          handleTicketEscalation(payload.new);
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 Desconectando notificações em tempo real...');
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
          description: `Ticket ${payload?.codigo_ticket} teve o SLA vencido e foi escalado automaticamente`,
          variant: 'destructive',
        });
        break;

      case 'sla_half':
        toast({
          title: '⚠️ SLA 50%',
          description: `Ticket ${payload?.codigo_ticket} atingiu 50% do SLA`,
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