-- Create function to check if user is active member of a team
CREATE OR REPLACE FUNCTION public.is_active_member_of_equipe(_user_id uuid, _equipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.equipe_members em
    WHERE em.user_id = _user_id 
    AND em.equipe_id = _equipe_id
    AND em.ativo = true
  )
$$;

-- Update can_view_ticket function to include team membership
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      has_role(auth.uid(), 'gerente'::app_role) AND
      ticket_unidade_id IN (
        SELECT u.id
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      ticket_unidade_id IN (
        SELECT c.unidade_id
        FROM colaboradores c
        JOIN profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      -- Team members can view tickets assigned to their team
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$$;

-- Update can_update_ticket function to include team membership  
CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      has_role(auth.uid(), 'gerente'::app_role) AND
      ticket_unidade_id IN (
        SELECT u.id
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      -- Team members can update tickets assigned to their team
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$$;