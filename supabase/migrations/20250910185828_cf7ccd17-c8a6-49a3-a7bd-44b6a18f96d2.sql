-- Remover políticas duplicadas de INSERT para avatars
DROP POLICY IF EXISTS "Authenticated users can insert avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;

-- Criar apenas UMA política de INSERT para avatars
CREATE POLICY "Users can upload avatars" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars');

-- Verificar se colaboradores podem atualizar seus próprios perfis
-- Adicionar política específica para colaboradores atualizarem perfis
CREATE POLICY "Colaboradores can update own profile" 
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id AND has_role(auth.uid(), 'colaborador'::app_role))
WITH CHECK (auth.uid() = id AND has_role(auth.uid(), 'colaborador'::app_role));