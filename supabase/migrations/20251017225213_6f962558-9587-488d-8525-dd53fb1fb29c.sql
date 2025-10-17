-- Criar política pública de INSERT para ticket_mensagens (validação feita via Edge Function)
CREATE POLICY "public_mobile_insert_ticket_mensagens"
ON public.ticket_mensagens
FOR INSERT
TO public
WITH CHECK (true);

-- NOTA: A validação de senha_web será feita via Edge Function antes do INSERT