-- Corrigir a política de atualização do perfil para incluir WITH CHECK correto
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;

-- Recriar a política com WITH CHECK explícito
CREATE POLICY "profiles_own_update" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Adicionar política específica para inserção de perfis
CREATE POLICY "profiles_own_insert" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);