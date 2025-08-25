-- Verificar e corrigir problemas de acesso
-- Primeiro, verificar se o usuário logado tem perfil e roles

-- Inserir perfil para usuário atual se não existir
INSERT INTO public.profiles (id, email, nome_completo, created_at, updated_at)
SELECT 
  auth.uid(), 
  (auth.jwt() -> 'email')::text,
  'Administrador Sistema',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid()
)
AND auth.uid() IS NOT NULL;

-- Atribuir role de admin se não existir
INSERT INTO public.user_roles (user_id, role)
SELECT auth.uid(), 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::app_role
)
AND auth.uid() IS NOT NULL;

-- Atribuir role de diretoria para acesso completo se não existir
INSERT INTO public.user_roles (user_id, role)
SELECT auth.uid(), 'diretoria'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'diretoria'::app_role
)
AND auth.uid() IS NOT NULL;