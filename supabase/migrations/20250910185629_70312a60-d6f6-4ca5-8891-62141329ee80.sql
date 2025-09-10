-- Verificar e adicionar política de INSERT que estava faltando
-- Verificar políticas existentes para avatars
SELECT policyname, cmd, qual FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' AND qual LIKE '%avatars%';

-- Adicionar política de INSERT que estava faltando
CREATE POLICY "Authenticated users can insert avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- Verificar se o bucket avatars está público
UPDATE storage.buckets SET public = true WHERE id = 'avatars';