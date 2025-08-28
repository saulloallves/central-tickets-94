-- Ensure tickets table has full replica identity and is in realtime publication
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_mensagens REPLICA IDENTITY FULL;

-- Add tables to realtime publication (will ignore if already exists)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_mensagens;