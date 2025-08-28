-- Ensure tables have full replica identity for complete realtime data
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_mensagens REPLICA IDENTITY FULL;