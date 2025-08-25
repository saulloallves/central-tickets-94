-- Enable realtime for tickets table
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;

-- Enable realtime for ticket_mensagens table  
ALTER TABLE public.ticket_mensagens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_mensagens;