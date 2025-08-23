
-- Atribuir papel 'colaborador' ao usuário pelo e-mail
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'colaborador'::app_role
FROM public.profiles p
WHERE p.email = 'daniel2028.007@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'colaborador'
  );
