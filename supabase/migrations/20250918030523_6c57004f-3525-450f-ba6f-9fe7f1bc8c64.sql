-- Configurar realtime para tabela tickets
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Adicionar tickets à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;