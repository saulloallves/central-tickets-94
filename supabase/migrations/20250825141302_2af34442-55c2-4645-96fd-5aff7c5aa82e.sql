-- Habilitar RLS nas tabelas que ainda não têm
ALTER TABLE public."RAG DOCUMENTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_source_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sequences ENABLE ROW LEVEL SECURITY;

-- Políticas para RAG DOCUMENTOS (já existe uma política admin, mas vou recriar para garantir)
DROP POLICY IF EXISTS "Only admins can access RAG documents" ON public."RAG DOCUMENTOS";
CREATE POLICY "Admins manage RAG documents" ON public."RAG DOCUMENTOS"
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para messaging_providers
CREATE POLICY "Admins manage messaging_providers" ON public.messaging_providers
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para notification_routes (já existem, mas vou verificar)
CREATE POLICY "Gerentes view notification_routes for their units" ON public.notification_routes
FOR SELECT USING (
  has_role(auth.uid(), 'gerente'::app_role) AND (
    unit_id IS NULL OR 
    unit_id IN (
      SELECT u.id FROM unidades u
      JOIN franqueados f ON f.unit_code ? u.id
      JOIN profiles p ON p.email = f.email
      WHERE p.id = auth.uid()
    )
  )
);

-- Políticas para notification_settings (já existem, mas vou verificar)
-- Mantém as existentes

-- Políticas para notification_source_config (já existem, mas vou verificar)
-- Mantém as existentes

-- Políticas para notifications_queue (já existe uma, mas vou melhorar)
CREATE POLICY "Users view notifications for accessible tickets" ON public.notifications_queue
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'diretoria'::app_role) OR
  (ticket_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM tickets t
    WHERE t.id = notifications_queue.ticket_id
    AND can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
  )) OR
  (ticket_id IS NULL AND has_role(auth.uid(), 'gerente'::app_role))
);

-- Políticas para message_templates (já existe uma, mas vou verificar)
CREATE POLICY "Authenticated users view active templates" ON public.message_templates
FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);

-- Políticas para ticket_sequences
CREATE POLICY "Admins manage ticket_sequences" ON public.ticket_sequences
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes view ticket_sequences for their units" ON public.ticket_sequences
FOR SELECT USING (
  has_role(auth.uid(), 'gerente'::app_role) AND
  unidade_id IN (
    SELECT u.id FROM unidades u
    JOIN franqueados f ON f.unit_code ? u.id
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "System can insert/update ticket_sequences" ON public.ticket_sequences
FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update ticket_sequences" ON public.ticket_sequences
FOR UPDATE USING (true) WITH CHECK (true);