-- Criar bucket para uploads do plano de ação
INSERT INTO storage.buckets (id, name, public)
VALUES ('plano-acao-uploads', 'plano-acao-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir uploads autenticados
CREATE POLICY "Usuários autenticados podem fazer upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'plano-acao-uploads');

-- Política para leitura pública
CREATE POLICY "Arquivos podem ser visualizados publicamente"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'plano-acao-uploads');

-- Política para deletar próprios arquivos
CREATE POLICY "Usuários podem deletar próprios uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'plano-acao-uploads');