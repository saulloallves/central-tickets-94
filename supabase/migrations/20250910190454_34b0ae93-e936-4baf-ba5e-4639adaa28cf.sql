-- Verificar se o auth.uid() está funcionando corretamente
SELECT auth.uid() as current_user_id;

-- Testar a política de update diretamente
SELECT 
  p.id,
  p.email,
  auth.uid() as auth_user_id,
  (auth.uid() = p.id) as can_update_check
FROM public.profiles p 
WHERE p.id = '329f4387-fb14-40ab-9309-622f3cd6ac4b';

-- Verificar se há alguma política WITH CHECK que pode estar causando problema
SELECT 
  policyname, 
  cmd, 
  permissive,
  qual as using_expression,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'profiles' 
AND cmd IN ('ALL', 'UPDATE')
ORDER BY policyname;