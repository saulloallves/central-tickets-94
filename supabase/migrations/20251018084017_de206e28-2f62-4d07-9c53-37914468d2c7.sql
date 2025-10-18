-- Permitir uploads públicos no bucket ticket-attachments para mobile
-- O bucket já é público para leitura, agora permitindo INSERT sem autenticação
-- Segurança: Edge function valida senha_web antes de criar mensagem
-- Frontend já tem limite de 16MB

DROP POLICY IF EXISTS "Authenticated users can upload ticket attachments" ON storage.objects;

CREATE POLICY "Anyone can upload ticket attachments"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'ticket-attachments');