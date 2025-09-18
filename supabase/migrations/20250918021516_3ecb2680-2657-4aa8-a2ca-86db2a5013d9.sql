-- Garantir que a tabela tickets tenha realtime ativo
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime se não estiver
DO $$
BEGIN
  -- Verificar se a tabela já está na publicação
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'tickets'
  ) THEN
    -- Adicionar à publicação
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
  END IF;
END $$;