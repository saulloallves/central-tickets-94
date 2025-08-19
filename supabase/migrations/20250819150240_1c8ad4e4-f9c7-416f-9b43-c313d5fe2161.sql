-- Fix RLS policy for equipe_members to allow admins to properly manage team members

-- Drop existing policies
DROP POLICY IF EXISTS "Admins manage equipe_members" ON public.equipe_members;
DROP POLICY IF EXISTS "Users can view their own equipe memberships" ON public.equipe_members;

-- Create new policies with proper logic
CREATE POLICY "Admins can manage all equipe_members" 
ON public.equipe_members 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own equipe memberships" 
ON public.equipe_members 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Also ensure we have an admin role for the current user if needed
-- First, let's make sure the user has admin role
DO $$
BEGIN
  -- Insert admin role for the current user if not exists
  INSERT INTO public.user_roles (user_id, role)
  SELECT '870c6202-d3fc-4b3d-a21a-381eff731740'::uuid, 'admin'::app_role
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = '870c6202-d3fc-4b3d-a21a-381eff731740'::uuid 
    AND role = 'admin'::app_role
  );
END $$;