-- Fix: Permitir que admins e diretoria enviem mensagens em qualquer ticket
-- sem precisar ser membro da equipe

-- Primeiro, dropar as políticas antigas de insert que são muito restritivas
DROP POLICY IF EXISTS "ticket_mensagens_admin_insert" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_diretoria_insert" ON public.ticket_mensagens;

-- Criar novas políticas mais permissivas para admin e diretoria
-- Admins podem inserir mensagens em qualquer ticket
CREATE POLICY "ticket_mensagens_admin_all"
ON public.ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Diretoria pode inserir mensagens em qualquer ticket
CREATE POLICY "ticket_mensagens_diretoria_all"
ON public.ticket_mensagens
FOR INSERT
TO public
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND has_role(auth.uid(), 'diretoria'::app_role)
);

-- Adicionar política UPDATE para admins e diretoria também
CREATE POLICY "ticket_mensagens_admin_update"
ON public.ticket_mensagens
FOR UPDATE
TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ticket_mensagens_diretoria_update"
ON public.ticket_mensagens
FOR UPDATE
TO public
USING (has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretoria'::app_role));

-- Adicionar política SELECT para admins e diretoria
CREATE POLICY "ticket_mensagens_admin_select"
ON public.ticket_mensagens
FOR SELECT
TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ticket_mensagens_diretoria_select"
ON public.ticket_mensagens
FOR SELECT
TO public
USING (has_role(auth.uid(), 'diretoria'::app_role));