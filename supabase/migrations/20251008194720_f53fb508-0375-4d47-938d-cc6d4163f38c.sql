-- Remover políticas restritivas de INSERT
DROP POLICY IF EXISTS "ticket_mensagens_admin_all" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_diretoria_all" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_colaborador_insert" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_franqueado_insert" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_team_insert" ON public.ticket_mensagens;

-- Criar política permissiva para qualquer usuário autenticado
CREATE POLICY "ticket_mensagens_authenticated_insert" 
ON public.ticket_mensagens
FOR INSERT 
TO public
WITH CHECK (auth.uid() IS NOT NULL);