-- Habilitar RLS nas tabelas que ainda não têm (apenas se não estiver habilitado)
DO $$
BEGIN
  -- RAG DOCUMENTOS
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'RAG DOCUMENTOS' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public."RAG DOCUMENTOS" ENABLE ROW LEVEL SECURITY;
  END IF;

  -- messaging_providers
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messaging_providers' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.messaging_providers ENABLE ROW LEVEL SECURITY;
  END IF;

  -- message_templates
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'message_templates' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
  END IF;

  -- ticket_sequences
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ticket_sequences' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.ticket_sequences ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Políticas para messaging_providers (apenas se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'messaging_providers' 
    AND policyname = 'Admins manage messaging_providers'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins manage messaging_providers" ON public.messaging_providers
    FOR ALL USING (has_role(auth.uid(), ''admin''::app_role))
    WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- Políticas para message_templates (apenas se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'message_templates' 
    AND policyname = 'Authenticated users view active templates'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users view active templates" ON public.message_templates
    FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL)';
  END IF;
END $$;

-- Políticas para ticket_sequences
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'ticket_sequences' 
    AND policyname = 'Admins manage ticket_sequences'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins manage ticket_sequences" ON public.ticket_sequences
    FOR ALL USING (has_role(auth.uid(), ''admin''::app_role))
    WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'ticket_sequences' 
    AND policyname = 'Gerentes view ticket_sequences for their units'
  ) THEN
    EXECUTE 'CREATE POLICY "Gerentes view ticket_sequences for their units" ON public.ticket_sequences
    FOR SELECT USING (
      has_role(auth.uid(), ''gerente''::app_role) AND
      unidade_id IN (
        SELECT u.id FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    )';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'ticket_sequences' 
    AND policyname = 'System can manage ticket_sequences'
  ) THEN
    EXECUTE 'CREATE POLICY "System can manage ticket_sequences" ON public.ticket_sequences
    FOR INSERT WITH CHECK (true)';
    
    EXECUTE 'CREATE POLICY "System can update ticket_sequences" ON public.ticket_sequences
    FOR UPDATE USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Melhorar política de notifications_queue se não existir uma específica
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'notifications_queue' 
    AND policyname = 'Users view notifications for accessible tickets'
  ) THEN
    EXECUTE 'CREATE POLICY "Users view notifications for accessible tickets" ON public.notifications_queue
    FOR SELECT USING (
      has_role(auth.uid(), ''admin''::app_role) OR
      has_role(auth.uid(), ''diretoria''::app_role) OR
      (ticket_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM tickets t
        WHERE t.id = notifications_queue.ticket_id
        AND can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
      )) OR
      (ticket_id IS NULL AND has_role(auth.uid(), ''gerente''::app_role))
    )';
  END IF;
END $$;