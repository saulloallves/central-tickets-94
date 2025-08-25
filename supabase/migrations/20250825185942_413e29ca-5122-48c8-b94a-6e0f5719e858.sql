-- Testar se o role franqueado funciona corretamente
-- Criar um usuário de teste com role franqueado
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'franqueado'::app_role
FROM auth.users 
WHERE email = 'franqueado.teste@email.com'
ON CONFLICT (user_id, role) DO NOTHING;