-- Habilitar realtime para a tabela chamados
ALTER TABLE public.chamados REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chamados;