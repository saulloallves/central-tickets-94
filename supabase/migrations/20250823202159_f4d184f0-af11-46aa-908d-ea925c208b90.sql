-- Create a safe function to check if user can view unidade
-- This function will avoid the infinite recursion issue
CREATE OR REPLACE FUNCTION public.user_can_view_unidade(unidade_id text, user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
BEGIN
  -- Admin can view all
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = user_can_view_unidade.user_id AND role = 'admin') THEN
    RETURN true;
  END IF;

  -- Diretoria can view all  
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = user_can_view_unidade.user_id AND role = 'diretoria') THEN
    RETURN true;
  END IF;

  -- Gerente can view units they manage
  IF EXISTS (
    SELECT 1 
    FROM public.franqueados f
    JOIN auth.users u ON u.email = f.email
    WHERE u.id = user_can_view_unidade.user_id 
    AND f.unit_code ? unidade_id
  ) THEN
    RETURN true;
  END IF;

  -- Colaborador can view their unit
  IF EXISTS (
    SELECT 1 
    FROM public.colaboradores c
    JOIN auth.users u ON u.email = c.email
    WHERE u.id = user_can_view_unidade.user_id 
    AND c.unidade_id = user_can_view_unidade.unidade_id
  ) THEN
    RETURN true;
  END IF;

  -- Users with global ticket permissions
  IF EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = user_can_view_unidade.user_id 
    AND rp.permission = 'view_all_tickets'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Drop existing policies on unidades table to recreate them safely
DROP POLICY IF EXISTS "Users view accessible unidades" ON public.unidades;
DROP POLICY IF EXISTS "Admins can manage all unidades" ON public.unidades;
DROP POLICY IF EXISTS "Users can view unidades linked to visible tickets" ON public.unidades;

-- Create new safe policies for unidades table
CREATE POLICY "Safe unidades access policy" 
ON public.unidades 
FOR SELECT 
USING (user_can_view_unidade(id));

-- Admin management policy
CREATE POLICY "Admins manage unidades"
ON public.unidades
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));