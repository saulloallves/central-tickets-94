-- Permitir SELECT público de tickets para acesso mobile sem autenticação
-- Usuários anônimos podem visualizar tickets (somente leitura)
-- IMPORTANTE: NÃO permite INSERT/UPDATE/DELETE - tickets só podem ser modificados por usuários autenticados

-- Remover política se já existir (evitar erro de duplicação)
DROP POLICY IF EXISTS "public_mobile_read_tickets" ON tickets;

-- Criar política pública de SELECT
CREATE POLICY "public_mobile_read_tickets"
ON tickets
FOR SELECT
TO public
USING (true);

-- Verificar e criar políticas para ticket_mensagens se não existirem
DROP POLICY IF EXISTS "public_mobile_read_ticket_mensagens" ON ticket_mensagens;
DROP POLICY IF EXISTS "public_mobile_insert_ticket_mensagens" ON ticket_mensagens;

CREATE POLICY "public_mobile_read_ticket_mensagens"
ON ticket_mensagens
FOR SELECT
TO public
USING (true);

CREATE POLICY "public_mobile_insert_ticket_mensagens"
ON ticket_mensagens
FOR INSERT
TO public
WITH CHECK (true);