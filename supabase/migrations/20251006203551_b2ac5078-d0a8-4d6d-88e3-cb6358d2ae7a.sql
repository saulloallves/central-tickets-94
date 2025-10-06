-- Remover função existente com CASCADE para permitir recriação
DROP FUNCTION IF EXISTS public.is_active_member_of_equipe(uuid, uuid) CASCADE;

-- Recriar função is_active_member_of_equipe com parâmetros corretos
CREATE OR REPLACE FUNCTION public.is_active_member_of_equipe(p_user_id uuid, p_equipe_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM equipe_members em
    WHERE em.user_id = p_user_id 
      AND em.equipe_id = p_equipe_id
      AND em.ativo = true
  );
END;
$$;

-- Remover políticas conflitantes de ticket_mensagens
DROP POLICY IF EXISTS "ticket_mensagens_admin_all" ON ticket_mensagens;
DROP POLICY IF EXISTS "Users can insert messages for their tickets" ON ticket_mensagens;
DROP POLICY IF EXISTS "Admins and diretoria can manage all ticket messages" ON ticket_mensagens;

-- Criar políticas INSERT separadas e ordenadas
CREATE POLICY "ticket_mensagens_admin_insert" ON ticket_mensagens
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ticket_mensagens_diretoria_insert" ON ticket_mensagens
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "ticket_mensagens_team_insert" ON ticket_mensagens
  FOR INSERT
  WITH CHECK (
    ticket_id IN (
      SELECT t.id FROM tickets t
      WHERE t.equipe_responsavel_id IS NOT NULL 
        AND is_active_member_of_equipe(auth.uid(), t.equipe_responsavel_id)
    )
  );

CREATE POLICY "ticket_mensagens_franqueado_insert" ON ticket_mensagens
  FOR INSERT
  WITH CHECK (
    ticket_id IN (
      SELECT t.id 
      FROM tickets t
      JOIN unidades u ON t.unidade_id = u.id
      JOIN franqueados_unidades fu ON fu.unidade_id = u.id
      JOIN franqueados f ON f.id = fu.franqueado_id
      JOIN profiles p ON p.email = f.email
      WHERE p.id = auth.uid()
    )
  );

-- Adicionar trigger para logging de tentativas de INSERT
CREATE OR REPLACE FUNCTION log_ticket_mensagens_errors()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE LOG 'Tentativa de INSERT em ticket_mensagens - ticket_id: %, usuario_id: %, auth.uid: %',
    NEW.ticket_id, NEW.usuario_id, auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_ticket_mensagens_insert ON ticket_mensagens;
CREATE TRIGGER before_ticket_mensagens_insert
  BEFORE INSERT ON ticket_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_mensagens_errors();

-- Adicionar política para service_role (edge functions)
CREATE POLICY "ticket_mensagens_service_role" ON ticket_mensagens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');