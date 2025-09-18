-- Verificar se a tabela tickets está na publicação realtime
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tickets';

-- Se não estiver, adicionar à publicação realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tickets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
        RAISE NOTICE 'Tabela tickets adicionada à publicação realtime';
    ELSE
        RAISE NOTICE 'Tabela tickets já está na publicação realtime';
    END IF;
END $$;

-- Configurar REPLICA IDENTITY FULL para capturar dados completos nas mudanças
ALTER TABLE public.tickets REPLICA IDENTITY FULL;