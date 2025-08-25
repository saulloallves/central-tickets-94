-- Fix infinite recursion in unidades table RLS policies
-- Drop all existing policies for unidades table
DROP POLICY IF EXISTS "Admins and diretoria can manage all unidades" ON public.unidades;
DROP POLICY IF EXISTS "Supervisores view unidades for their units" ON public.unidades;
DROP POLICY IF EXISTS "Gerentes view unidades" ON public.unidades;
DROP POLICY IF EXISTS "Authenticated users can view active unidades" ON public.unidades;
DROP POLICY IF EXISTS "Users can view unidades" ON public.unidades;

-- Create simple, non-recursive RLS policies for unidades table
-- Admins and diretoria can manage all unidades
CREATE POLICY "Admins and diretoria can manage all unidades" 
ON public.unidades
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Supervisores can view all unidades
CREATE POLICY "Supervisores can view all unidades" 
ON public.unidades
FOR SELECT
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Users with view_all_tickets permission can see unidades
CREATE POLICY "Users with view_all_tickets can view unidades" 
ON public.unidades
FOR SELECT
USING (has_permission(auth.uid(), 'view_all_tickets'::app_permission));

-- Authenticated users can view unidades (fallback for now)
CREATE POLICY "Authenticated users can view unidades" 
ON public.unidades
FOR SELECT
USING (auth.uid() IS NOT NULL);