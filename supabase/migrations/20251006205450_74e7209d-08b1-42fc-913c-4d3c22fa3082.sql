
-- Fix RLS policies for ticket_mensagens to handle service_role properly
-- The service_role policy should be checked FIRST and bypass other checks

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "ticket_mensagens_service_role" ON ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_admin_insert" ON ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_diretoria_insert" ON ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_team_insert" ON ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_franqueado_insert" ON ticket_mensagens;

-- Create service_role policy FIRST (highest priority)
CREATE POLICY "ticket_mensagens_service_role"
ON ticket_mensagens
FOR ALL
TO public
USING (
  -- Service role bypasses all checks
  auth.jwt() IS NULL OR 
  auth.role() = 'service_role'
)
WITH CHECK (
  -- Service role bypasses all checks
  auth.jwt() IS NULL OR 
  auth.role() = 'service_role'
);

-- Admin policy
CREATE POLICY "ticket_mensagens_admin_insert"
ON ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Diretoria policy
CREATE POLICY "ticket_mensagens_diretoria_insert"
ON ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND
  has_role(auth.uid(), 'diretoria'::app_role)
);

-- Team member policy
CREATE POLICY "ticket_mensagens_team_insert"
ON ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND
  ticket_id IN (
    SELECT t.id FROM tickets t
    WHERE t.equipe_responsavel_id IS NOT NULL
    AND is_active_member_of_equipe(auth.uid(), t.equipe_responsavel_id)
  )
);

-- Franqueado policy
CREATE POLICY "ticket_mensagens_franqueado_insert"
ON ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL AND
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
