-- ============================================
-- FIX: Permitir colaboradores visualizarem e enviarem mensagens nos tickets
-- ============================================

-- =============================================
-- PARTE 1: REMOVER POLÍTICA DE DEBUG INSEGURA
-- =============================================

DROP POLICY IF EXISTS "ticket_mensagens_debug_insert_allow_all" ON public.ticket_mensagens;
DROP TRIGGER IF EXISTS log_ticket_mensagens_insert_trigger ON public.ticket_mensagens;
DROP FUNCTION IF EXISTS public.log_ticket_mensagens_insert();

-- =============================================
-- PARTE 2: POLÍTICAS DE SELECT (VISUALIZAR)
-- =============================================

-- Colaboradores podem visualizar mensagens dos tickets que eles podem acessar
CREATE POLICY "ticket_mensagens_colaborador_select"
ON public.ticket_mensagens
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL AND
  has_role(auth.uid(), 'colaborador'::app_role) AND
  ticket_id IN (
    SELECT t.id 
    FROM tickets t
    WHERE can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
  )
);

-- Membros de equipe podem visualizar mensagens dos tickets da sua equipe
CREATE POLICY "ticket_mensagens_team_select"
ON public.ticket_mensagens
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL AND
  ticket_id IN (
    SELECT t.id 
    FROM tickets t
    WHERE t.equipe_responsavel_id IS NOT NULL
    AND is_active_member_of_equipe(auth.uid(), t.equipe_responsavel_id)
  )
);

-- Franqueados podem visualizar mensagens dos seus tickets
CREATE POLICY "ticket_mensagens_franqueado_select"
ON public.ticket_mensagens
FOR SELECT
TO public
USING (
  auth.uid() IS NOT NULL AND
  (
    has_role(auth.uid(), 'franqueado'::app_role) OR 
    has_role(auth.uid(), 'gerente'::app_role)
  ) AND
  ticket_id IN (
    SELECT t.id 
    FROM tickets t
    JOIN unidades u ON t.unidade_id = u.id
    JOIN franqueados_unidades fu ON fu.unidade_id = u.id
    JOIN franqueados f ON f.id = fu.franqueado_id
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);

-- =============================================
-- PARTE 3: POLÍTICAS DE INSERT (ENVIAR MENSAGENS)
-- =============================================

-- Colaboradores podem enviar mensagens nos tickets que eles podem acessar
CREATE POLICY "ticket_mensagens_colaborador_insert"
ON public.ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND
  has_role(auth.uid(), 'colaborador'::app_role) AND
  ticket_id IN (
    SELECT t.id 
    FROM tickets t
    WHERE can_update_ticket(t.unidade_id, t.equipe_responsavel_id)
  )
);

-- Membros de equipe podem enviar mensagens nos tickets da sua equipe
CREATE POLICY "ticket_mensagens_team_insert"
ON public.ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND
  ticket_id IN (
    SELECT t.id 
    FROM tickets t
    WHERE t.equipe_responsavel_id IS NOT NULL
    AND is_active_member_of_equipe(auth.uid(), t.equipe_responsavel_id)
  )
);

-- Franqueados podem enviar mensagens nos seus tickets
CREATE POLICY "ticket_mensagens_franqueado_insert"
ON public.ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND
  (
    has_role(auth.uid(), 'franqueado'::app_role) OR 
    has_role(auth.uid(), 'gerente'::app_role)
  ) AND
  ticket_id IN (
    SELECT t.id 
    FROM tickets t
    JOIN unidades u ON t.unidade_id = u.id
    JOIN franqueados_unidades fu ON fu.unidade_id = u.id
    JOIN franqueados f ON f.id = fu.franqueado_id
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);

-- Admin pode enviar mensagens em qualquer ticket
CREATE POLICY "ticket_mensagens_admin_insert"
ON public.ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Diretoria pode enviar mensagens em qualquer ticket
CREATE POLICY "ticket_mensagens_diretoria_insert"
ON public.ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND
  has_role(auth.uid(), 'diretoria'::app_role)
);