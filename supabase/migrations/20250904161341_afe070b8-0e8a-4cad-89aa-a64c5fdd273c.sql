-- Remover políticas duplicadas e conflitantes para avatars
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "public_avatar_access" ON storage.objects;

-- Criar políticas corretas e não conflitantes para avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
TO public 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
TO public 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
TO public 
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
TO public 
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL 
  AND auth.uid()::text = (storage.foldername(name))[1]
);