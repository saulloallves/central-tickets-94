-- Fix RLS recursion issues in unidades and ticket functions

-- 1. Create safe function to check unit access without referencing unidades table
CREATE OR REPLACE FUNCTION public.user_can_view_unidade(u_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Admin can see all
    has_role(auth.uid(), 'admin'::app_role) OR
    -- Diretoria can see all
    has_role(auth.uid(), 'diretoria'::app_role) OR
    -- Gerente can see units they manage (check franqueados table directly)
    (
      has_role(auth.uid(), 'gerente'::app_role) AND
      EXISTS (
        SELECT 1
        FROM franqueados f
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
        AND f.unit_code ? u_id
      )
    ) OR
    -- Colaborador can see their assigned unit
    EXISTS (
      SELECT 1
      FROM colaboradores c
      JOIN profiles p ON p.email = c.email
      WHERE p.id = auth.uid()
      AND c.unidade_id = u_id
    )
$$;

-- 2. Drop existing problematic policies on unidades
DROP POLICY IF EXISTS "Admins can manage all unidades" ON public.unidades;
DROP POLICY IF EXISTS "Gerentes can view managed unidades" ON public.unidades;
DROP POLICY IF EXISTS "Colaboradores can view their unidades" ON public.unidades;
DROP POLICY IF EXISTS "Authenticated users can view unidades" ON public.unidades;

-- 3. Create safe policies for unidades table
CREATE POLICY "Authenticated users can view unidades"
ON public.unidades
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage unidades"
ON public.unidades
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view accessible unidades"
ON public.unidades
FOR SELECT
TO authenticated
USING (user_can_view_unidade(id));

-- 4. Update can_view_ticket function to avoid unidades joins
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      has_role(auth.uid(), 'gerente'::app_role) AND
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
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    ) OR
    EXISTS (
      SELECT 1
      FROM colaboradores c
      JOIN profiles p ON p.email = c.email
      WHERE p.id = auth.uid()
      AND c.unidade_id = ticket_unidade_id
    )
$$;

-- 5. Update can_update_ticket function to avoid unidades joins
CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      has_role(auth.uid(), 'gerente'::app_role) AND
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
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$$;

-- 6. Ensure tickets policies use the safe functions
DROP POLICY IF EXISTS "Users can view tickets they have access to" ON public.tickets;
DROP POLICY IF EXISTS "Users can update tickets they can manage" ON public.tickets;

CREATE POLICY "Users can view tickets they have access to"
ON public.tickets
FOR SELECT
TO authenticated
USING (can_view_ticket(unidade_id, equipe_responsavel_id));

CREATE POLICY "Users can update tickets they can manage"
ON public.tickets
FOR UPDATE
TO authenticated
USING (can_update_ticket(unidade_id, equipe_responsavel_id));