-- Habilitar realtime para a tabela tickets
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;