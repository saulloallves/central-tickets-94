-- Criar política RLS para permitir edge functions lerem messaging_providers ativos
CREATE POLICY "Edge functions can read active messaging providers"
ON messaging_providers
FOR SELECT
TO anon, authenticated
USING (is_active = true);