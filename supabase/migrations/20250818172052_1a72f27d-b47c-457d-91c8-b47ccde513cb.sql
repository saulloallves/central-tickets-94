-- Insert admin role for the current user
INSERT INTO public.user_roles (user_id, role)
SELECT '870c6202-d3fc-4b3d-a21a-381eff731740'::uuid, 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = '870c6202-d3fc-4b3d-a21a-381eff731740'::uuid 
  AND role = 'admin'::app_role
);