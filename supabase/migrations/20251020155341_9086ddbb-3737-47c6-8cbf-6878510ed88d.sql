-- Implementar Solução 1: Política condicional por autenticação
-- Apenas usuários NÃO autenticados (auth.uid() IS NULL) têm acesso público aos tickets
-- Usuários autenticados seguem as políticas existentes por equipe/permissão

-- Remover política permissiva atual
DROP POLICY IF EXISTS "public_mobile_read_tickets" ON tickets;

-- Criar política condicional: apenas usuários anônimos têm acesso público
CREATE POLICY "public_mobile_read_tickets"
ON tickets
FOR SELECT
TO public
USING (
  -- Apenas usuários NÃO autenticados têm acesso público
  auth.uid() IS NULL
);