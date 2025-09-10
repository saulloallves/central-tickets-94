-- Atualizar políticas RLS para internal_access_requests
-- Permitir que admins e diretoria vejam todas as solicitações

-- Remover políticas existentes
DROP POLICY IF EXISTS "IAR: admins and diretoria manage all" ON internal_access_requests;
DROP POLICY IF EXISTS "IAR: users can view own" ON internal_access_requests;
DROP POLICY IF EXISTS "IAR: users can insert own" ON internal_access_requests;

-- Criar novas políticas mais permissivas
CREATE POLICY "Admins and diretoria manage all internal_access_requests"
ON internal_access_requests
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "Users can view own internal_access_requests"
ON internal_access_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own internal_access_requests"
ON internal_access_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);