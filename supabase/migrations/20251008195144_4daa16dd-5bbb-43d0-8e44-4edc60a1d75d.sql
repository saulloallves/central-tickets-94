-- POLÍTICA DE DEBUG TEMPORÁRIA - REMOVER DEPOIS!
-- Esta política permite INSERT sem nenhuma restrição para debug

-- Primeiro, remover TODAS as políticas de INSERT existentes
DROP POLICY IF EXISTS "ticket_mensagens_authenticated_insert" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_admin_all" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_diretoria_all" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_colaborador_insert" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_franqueado_insert" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "ticket_mensagens_team_insert" ON public.ticket_mensagens;

-- Criar política EXTREMAMENTE permissiva para debug (SEM VERIFICAÇÃO DE AUTH)
-- ⚠️ ATENÇÃO: Esta política é INSEGURA e deve ser usada APENAS para debug
CREATE POLICY "ticket_mensagens_debug_insert_allow_all" 
ON public.ticket_mensagens
FOR INSERT 
TO public
WITH CHECK (true);

-- Log para rastrear inserções
CREATE OR REPLACE FUNCTION public.log_ticket_mensagens_insert()
RETURNS TRIGGER AS $$
BEGIN
  RAISE NOTICE 'ticket_mensagens INSERT - ticket_id: %, usuario_id: %, auth.uid(): %, direcao: %', 
    NEW.ticket_id, NEW.usuario_id, auth.uid(), NEW.direcao;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para logging
DROP TRIGGER IF EXISTS log_ticket_mensagens_insert_trigger ON public.ticket_mensagens;
CREATE TRIGGER log_ticket_mensagens_insert_trigger
  BEFORE INSERT ON public.ticket_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.log_ticket_mensagens_insert();