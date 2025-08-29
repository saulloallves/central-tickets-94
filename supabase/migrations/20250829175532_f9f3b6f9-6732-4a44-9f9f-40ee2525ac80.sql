-- Ensure tickets table has REPLICA IDENTITY FULL for complete real-time updates
ALTER TABLE public.tickets REPLICA IDENTITY FULL;