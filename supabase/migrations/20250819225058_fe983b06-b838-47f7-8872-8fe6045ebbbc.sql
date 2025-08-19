-- Habilitar RLS nas tabelas restantes que ainda estão sem
ALTER TABLE public.ticket_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_queue ENABLE ROW LEVEL SECURITY;

-- Tabela que pode não ter RLS habilitado
DO $$
BEGIN
  -- Verificar se existe a tabela v_kb_articles_usage e habilitar RLS se for uma tabela
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v_kb_articles_usage') THEN
    -- É uma view, não precisa de RLS
    NULL;
  END IF;
  
  -- Verificar se existe a tabela v_kb_resolution_rate  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v_kb_resolution_rate') THEN
    -- É uma view, não precisa de RLS
    NULL;
  END IF;
END $$;

-- Agora que o principal problema foi resolvido, o drag-and-drop deve funcionar
-- O erro era que o trigger audit_ticket_changes tentava inserir na tickets_audit
-- mas não havia política RLS permitindo INSERT