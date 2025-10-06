-- Fix RLS policies in ticket_mensagens that use jsonb ? uuid
-- Convert UUID to text when using JSONB ? operator

-- Drop existing policies that might have the issue
DROP POLICY IF EXISTS "Users can insert messages for their tickets" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "Users can view messages for their tickets" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "Colaboradores can insert ticket messages" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "Colaboradores can view ticket messages" ON public.ticket_mensagens;

-- Recreate policies with proper UUID::text conversion
CREATE POLICY "Users can insert messages for their tickets"
ON public.ticket_mensagens
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'diretoria'::app_role) OR
  (
    ticket_id IN (
      SELECT t.id
      FROM tickets t
      JOIN unidades u ON t.unidade_id = u.id
      JOIN franqueados f ON f.unit_code ? u.id::text
      JOIN profiles p ON p.email = f.email
      WHERE p.id = auth.uid()
    )
  ) OR
  (
    ticket_id IN (
      SELECT t.id
      FROM tickets t
      WHERE t.equipe_responsavel_id IS NOT NULL
        AND is_active_member_of_equipe(auth.uid(), t.equipe_responsavel_id)
    )
  )
);

CREATE POLICY "Users can view messages for their tickets"
ON public.ticket_mensagens
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'diretoria'::app_role) OR
  (
    ticket_id IN (
      SELECT t.id
      FROM tickets t
      JOIN unidades u ON t.unidade_id = u.id
      JOIN franqueados f ON f.unit_code ? u.id::text
      JOIN profiles p ON p.email = f.email
      WHERE p.id = auth.uid()
    )
  ) OR
  (
    ticket_id IN (
      SELECT t.id
      FROM tickets t
      WHERE t.equipe_responsavel_id IS NOT NULL
        AND is_active_member_of_equipe(auth.uid(), t.equipe_responsavel_id)
    )
  )
);