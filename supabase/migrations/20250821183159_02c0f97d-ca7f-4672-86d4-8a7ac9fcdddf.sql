-- Criar bucket para arquivos de memórias da base de conhecimento
INSERT INTO storage.buckets (id, name, public) 
VALUES ('knowledge', 'knowledge', false);

-- Criar políticas de acesso para o bucket knowledge
CREATE POLICY "Admins can upload to knowledge bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'knowledge' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view knowledge files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'knowledge' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update knowledge files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'knowledge' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete knowledge files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'knowledge' AND has_role(auth.uid(), 'admin'::app_role));