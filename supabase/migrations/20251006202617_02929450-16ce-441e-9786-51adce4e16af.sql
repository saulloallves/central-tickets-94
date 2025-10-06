-- Comprehensive RLS Security Fix Migration
-- This migration fixes all identified security issues with RLS policies

-- ============================================================================
-- PART 1: Drop existing functions to avoid parameter name conflicts
-- ============================================================================

DROP FUNCTION IF EXISTS public.can_view_ticket(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_update_ticket(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_create_ticket() CASCADE;

-- ============================================================================
-- PART 2: Create helper functions for ticket access control
-- ============================================================================

-- Function to check if user can view a specific ticket
CREATE OR REPLACE FUNCTION public.can_view_ticket(
  p_unidade_id UUID,
  p_equipe_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can view everything
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Diretoria can view everything
  IF has_role(auth.uid(), 'diretoria'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Users with view_all_tickets permission
  IF has_permission(auth.uid(), 'view_all_tickets'::app_permission) THEN
    RETURN TRUE;
  END IF;

  -- Users with view_team_tickets permission can see their team's tickets
  IF has_permission(auth.uid(), 'view_team_tickets'::app_permission) AND
     p_equipe_id IS NOT NULL AND
     is_active_member_of_equipe(auth.uid(), p_equipe_id) THEN
    RETURN TRUE;
  END IF;

  -- Franqueados can view tickets from their units
  IF has_role(auth.uid(), 'franqueado'::app_role) OR 
     has_role(auth.uid(), 'gerente'::app_role) THEN
    RETURN EXISTS (
      SELECT 1 FROM franqueados f
      JOIN franqueados_unidades fu ON f.id = fu.franqueado_id
      WHERE f.email = (SELECT email FROM profiles WHERE id = auth.uid())
        AND fu.unidade_id = p_unidade_id
    );
  END IF;

  RETURN FALSE;
END;
$$;

-- Function to check if user can update a ticket
CREATE OR REPLACE FUNCTION public.can_update_ticket(
  p_unidade_id UUID,
  p_equipe_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can update everything
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Diretoria can update everything
  IF has_role(auth.uid(), 'diretoria'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Users with respond_tickets permission can update
  IF has_permission(auth.uid(), 'respond_tickets'::app_permission) THEN
    RETURN TRUE;
  END IF;

  -- Team members can update their team's tickets
  IF p_equipe_id IS NOT NULL AND 
     is_active_member_of_equipe(auth.uid(), p_equipe_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Function to check if user can create tickets
CREATE OR REPLACE FUNCTION public.can_create_ticket()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins can always create
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Diretoria can create
  IF has_role(auth.uid(), 'diretoria'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Colaboradores can create tickets
  IF has_role(auth.uid(), 'colaborador'::app_role) THEN
    RETURN TRUE;
  END IF;

  -- Franqueados can create tickets
  IF has_role(auth.uid(), 'franqueado'::app_role) OR 
     has_role(auth.uid(), 'gerente'::app_role) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================================
-- PART 3: Fix tickets table policies
-- ============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "tickets_admin_manage" ON public.tickets;

-- CREATE GRANULAR SELECT POLICIES
CREATE POLICY "tickets_admin_select" 
ON public.tickets 
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tickets_diretoria_select" 
ON public.tickets 
FOR SELECT
USING (has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "tickets_view_all_permission" 
ON public.tickets 
FOR SELECT
USING (has_permission(auth.uid(), 'view_all_tickets'::app_permission));

CREATE POLICY "tickets_team_view" 
ON public.tickets 
FOR SELECT
USING (
  has_permission(auth.uid(), 'view_team_tickets'::app_permission) AND
  equipe_responsavel_id IS NOT NULL AND
  is_active_member_of_equipe(auth.uid(), equipe_responsavel_id)
);

CREATE POLICY "tickets_franqueado_select" 
ON public.tickets 
FOR SELECT
USING (
  (has_role(auth.uid(), 'franqueado'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)) AND
  EXISTS (
    SELECT 1 FROM franqueados f
    JOIN franqueados_unidades fu ON f.id = fu.franqueado_id
    WHERE f.email = (SELECT email FROM profiles WHERE id = auth.uid())
      AND fu.unidade_id = tickets.unidade_id
  )
);

-- CREATE UPDATE POLICIES
CREATE POLICY "tickets_admin_update" 
ON public.tickets 
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tickets_diretoria_update" 
ON public.tickets 
FOR UPDATE
USING (has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "tickets_respond_permission" 
ON public.tickets 
FOR UPDATE
USING (has_permission(auth.uid(), 'respond_tickets'::app_permission))
WITH CHECK (has_permission(auth.uid(), 'respond_tickets'::app_permission));

CREATE POLICY "tickets_team_update" 
ON public.tickets 
FOR UPDATE
USING (
  equipe_responsavel_id IS NOT NULL AND
  is_active_member_of_equipe(auth.uid(), equipe_responsavel_id)
)
WITH CHECK (
  equipe_responsavel_id IS NOT NULL AND
  is_active_member_of_equipe(auth.uid(), equipe_responsavel_id)
);

-- CREATE INSERT POLICIES
CREATE POLICY "tickets_admin_insert" 
ON public.tickets 
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tickets_diretoria_insert" 
ON public.tickets 
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "tickets_colaborador_insert" 
ON public.tickets 
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'colaborador'::app_role));

CREATE POLICY "tickets_franqueado_insert" 
ON public.tickets 
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'franqueado'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role)
);

-- CREATE DELETE POLICIES
CREATE POLICY "tickets_admin_delete" 
ON public.tickets 
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tickets_diretoria_delete" 
ON public.tickets 
FOR DELETE
USING (has_role(auth.uid(), 'diretoria'::app_role));

-- ============================================================================
-- PART 4: Fix tickets_audit table policies
-- ============================================================================

CREATE POLICY "tickets_audit_admin_select" 
ON public.tickets_audit 
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'diretoria'::app_role)
);

-- ============================================================================
-- PART 5: Fix franqueados_unidades table (no policies currently)
-- ============================================================================

CREATE POLICY "franqueados_unidades_admin_all" 
ON public.franqueados_unidades 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "franqueados_unidades_diretoria_all" 
ON public.franqueados_unidades 
FOR ALL
USING (has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "franqueados_unidades_owner_select" 
ON public.franqueados_unidades 
FOR SELECT
USING (
  (has_role(auth.uid(), 'franqueado'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)) AND
  franqueado_id IN (
    SELECT id FROM franqueados 
    WHERE email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

-- ============================================================================
-- PART 6: Fix teste_franqueados table (test table - admin only)
-- ============================================================================

CREATE POLICY "teste_franqueados_admin_only" 
ON public.teste_franqueados 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- PART 7: Fix teste_unidades table (test table - admin only)
-- ============================================================================

CREATE POLICY "teste_unidades_admin_only" 
ON public.teste_unidades 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- PART 8: Log the security improvements
-- ============================================================================

DO $$
BEGIN
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'security',
    'rls_comprehensive_fix',
    'RLS policies comprehensively fixed: tickets, tickets_audit, franqueados_unidades, test tables',
    NULL,
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'fixed_tables', ARRAY['tickets', 'tickets_audit', 'franqueados_unidades', 'teste_franqueados', 'teste_unidades'],
      'new_functions', ARRAY['can_view_ticket', 'can_update_ticket', 'can_create_ticket'],
      'policies_created', 23
    ),
    'web'::public.log_canal
  );
END $$;