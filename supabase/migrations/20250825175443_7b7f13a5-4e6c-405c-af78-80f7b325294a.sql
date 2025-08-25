-- Create a safe function to get user role without causing recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid DEFAULT auth.uid())
RETURNS app_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_roles.user_id = $1 
  LIMIT 1;
$$;

-- Create a safe function to check if user can view tickets
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      public.has_role(auth.uid(), 'supervisor'::app_role) AND
      EXISTS (
        SELECT 1
        FROM franqueados f
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
        AND f.unit_code ? ticket_unidade_id
      )
    ) OR
    (
      ticket_equipe_id IS NOT NULL AND
      public.is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    ) OR
    (
      ticket_unidade_id IN (
        SELECT c.unidade_id
        FROM colaboradores c
        JOIN profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    )
$$;