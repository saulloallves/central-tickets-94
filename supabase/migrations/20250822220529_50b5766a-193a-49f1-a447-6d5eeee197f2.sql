-- Verificar se o bucket avatars existe e criar se necessário
DO $$
BEGIN
    -- Verificar se o bucket já existe
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
        -- Criar bucket para avatars (público)
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('avatars', 'avatars', true);
        
        -- Criar políticas de storage para avatars
        CREATE POLICY "Avatar images are publicly accessible" 
        ON storage.objects 
        FOR SELECT 
        USING (bucket_id = 'avatars');

        CREATE POLICY "Users can upload their own avatar" 
        ON storage.objects 
        FOR INSERT 
        WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

        CREATE POLICY "Users can update their own avatar" 
        ON storage.objects 
        FOR UPDATE 
        USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

        CREATE POLICY "Users can delete their own avatar" 
        ON storage.objects 
        FOR DELETE 
        USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END
$$;