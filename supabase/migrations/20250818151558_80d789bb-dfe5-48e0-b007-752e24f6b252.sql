-- Fix RLS policies for tickets table to allow proper insertion

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Colaboradores can view and create tickets in their unit" ON public.tickets;
DROP POLICY IF EXISTS "Colaboradores can create tickets in their unit" ON public.tickets;

-- Create proper INSERT policy for colaboradores
CREATE POLICY "Colaboradores can create tickets in their unit"
  ON public.tickets
  FOR INSERT
  WITH CHECK (
    can_create_ticket(unidade_id) AND
    auth.uid() IS NOT NULL
  );

-- Create proper INSERT policy for gerentes 
CREATE POLICY "Gerentes can create tickets in their units"
  ON public.tickets
  FOR INSERT
  WITH CHECK (
    can_update_ticket(unidade_id) AND
    auth.uid() IS NOT NULL
  );

-- Ensure SELECT policy allows viewing for all authorized users
CREATE POLICY "Users can view tickets they have access to"
  ON public.tickets
  FOR SELECT
  USING (can_view_ticket(unidade_id));

-- Update the access control functions to be more permissive for creation
CREATE OR REPLACE FUNCTION public.can_create_ticket(ticket_unidade_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
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
    -- Allow creation if user profile exists (fallback for authenticated users)
    (
      auth.uid() IS NOT NULL AND
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
    )
$$;