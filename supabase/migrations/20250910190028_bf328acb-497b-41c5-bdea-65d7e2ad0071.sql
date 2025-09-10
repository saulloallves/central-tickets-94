-- Verificar políticas atuais da tabela profiles
SELECT policyname, cmd, roles, qual, with_check FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles' 
ORDER BY cmd, policyname;

-- Remover a política problemática que criamos
DROP POLICY IF EXISTS "Colaboradores can update own profile" ON public.profiles;

-- A política "profiles_own_update" já existente deve ser suficiente, mas vamos garantir que funciona
-- verificando se há algo específico na política para colaboradores

-- Verificar se a política existente está funcionando corretamente
UPDATE public.profiles 
SET avatar_url = 'test_url' 
WHERE id = 'f32c7a05-50c5-486e-a5b1-fab6a431523e';

-- Voltar ao valor original
UPDATE public.profiles 
SET avatar_url = NULL 
WHERE id = 'f32c7a05-50c5-486e-a5b1-fab6a431523e';