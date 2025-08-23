
-- Habilitar REPLICA IDENTITY FULL para capturar payloads completos
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER TABLE public.logs_de_sistema REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.notifications_queue REPLICA IDENTITY FULL;
ALTER TABLE public.crises_ativas REPLICA IDENTITY FULL;

-- Adicionar as tabelas à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_de_sistema;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crises_ativas;
