-- Enable realtime for tickets table
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Ensure tickets table is added to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;