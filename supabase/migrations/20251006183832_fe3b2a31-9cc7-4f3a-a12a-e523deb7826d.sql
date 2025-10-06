-- Drop existing can_view_ticket functions with TEXT parameter
DROP FUNCTION IF EXISTS public.can_view_ticket(text);
DROP FUNCTION IF EXISTS public.can_view_ticket(text, uuid);

-- Create can_view_ticket function with UUID parameter (single parameter version)
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'diretoria'::app_role) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      ticket_unidade_id::text IN (
        SELECT u.id::text
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id::text
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      ticket_unidade_id::text IN (
        SELECT c.unidade_id::text
        FROM colaboradores c
        JOIN profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    ) OR
    has_permission(auth.uid(), 'view_all_tickets'::app_permission)
$$;

-- Create can_view_ticket function with UUID parameters (two parameter version)
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id uuid, ticket_equipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'diretoria'::app_role) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      ticket_unidade_id::text IN (
        SELECT u.id::text
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id::text
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      ticket_unidade_id::text IN (
        SELECT c.unidade_id::text
        FROM colaboradores c
        JOIN profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    ) OR
    has_permission(auth.uid(), 'view_all_tickets'::app_permission)
$$;