
-- 1) Garantir que a tabela tickets emite eventos completos no WAL (necessário para Realtime)
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- 2) Adicionar a tabela tickets à publicação Realtime (ignorar se já estiver adicionada)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) Garantir que updated_at atualize em todo UPDATE (usado para consistência/recuperação rápida)
DO $$
BEGIN
  CREATE TRIGGER set_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
