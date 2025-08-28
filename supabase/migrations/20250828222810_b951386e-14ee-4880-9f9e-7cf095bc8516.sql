-- Enable realtime for tickets table
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Add tickets table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;