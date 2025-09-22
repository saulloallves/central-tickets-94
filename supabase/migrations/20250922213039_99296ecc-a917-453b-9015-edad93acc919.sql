-- Habilitar realtime para as tabelas de notificações
ALTER TABLE public.internal_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.internal_notification_recipients REPLICA IDENTITY FULL;
ALTER TABLE public.notifications_queue REPLICA IDENTITY FULL;
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Adicionar as tabelas à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_notification_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;