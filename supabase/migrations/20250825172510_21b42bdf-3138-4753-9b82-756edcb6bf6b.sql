-- Limpar políticas RLS duplicadas para a tabela unidades
DROP POLICY IF EXISTS "Admins manage unidades" ON public.unidades;
DROP POLICY IF EXISTS "Diretoria view all unidades" ON public.unidades;
DROP POLICY IF EXISTS "Gerentes view managed unidades" ON public.unidades;
DROP POLICY IF EXISTS "Colaboradores view own unidade" ON public.unidades;
DROP POLICY IF EXISTS "Atendentes view all unidades (permission)" ON public.unidades;
DROP POLICY IF EXISTS "Authenticated users can view unidades" ON public.unidades;
DROP POLICY IF EXISTS "Admins can manage unidades" ON public.unidades;
DROP POLICY IF EXISTS "Users can view accessible unidades" ON public.unidades;
DROP POLICY IF EXISTS "Admin manage unidades" ON public.unidades;
DROP POLICY IF EXISTS "Authenticated view unidades" ON public.unidades;

-- Criar políticas mais simples e claras
CREATE POLICY "Admin e diretoria pode gerenciar todas as unidades" 
ON public.unidades 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "Supervisores podem ver unidades sob sua gestão" 
ON public.unidades 
FOR SELECT 
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND 
  id IN (
    SELECT u.id
    FROM unidades u
    JOIN franqueados f ON f.unit_code ? u.id
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Colaboradores podem ver sua própria unidade" 
ON public.unidades 
FOR SELECT 
USING (
  id IN (
    SELECT c.unidade_id
    FROM colaboradores c
    JOIN profiles p ON p.email = c.email
    WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Usuários com permissão view_all_tickets podem ver todas as unidades" 
ON public.unidades 
FOR SELECT 
USING (has_permission(auth.uid(), 'view_all_tickets'::app_permission));

CREATE POLICY "Usuários autenticados podem ver unidades" 
ON public.unidades 
FOR SELECT 
USING (auth.uid() IS NOT NULL);