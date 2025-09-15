-- Remover políticas existentes da tabela chamados
DROP POLICY IF EXISTS "Admins and diretoria manage chamados" ON public.chamados;
DROP POLICY IF EXISTS "Colaboradores view chamados in their units" ON public.chamados;
DROP POLICY IF EXISTS "Franqueados view their chamados" ON public.chamados;
DROP POLICY IF EXISTS "Authenticated users can insert chamados" ON public.chamados;
DROP POLICY IF EXISTS "Users can update chamados they can view" ON public.chamados;

-- Criar política permissiva para todos os usuários autenticados
CREATE POLICY "Authenticated users can view all chamados"
ON public.chamados
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert chamados"
ON public.chamados
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all chamados"
ON public.chamados
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete chamados"
ON public.chamados
FOR DELETE
TO authenticated
USING (true);