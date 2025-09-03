-- Atualizar permissões do colaborador - remover view_all_tickets e view_own_unit_tickets
DELETE FROM role_permissions WHERE role = 'colaborador' AND permission IN ('view_all_tickets', 'view_own_unit_tickets');

-- Atualizar a função can_view_ticket para restringir colaboradores apenas aos tickets de sua equipe
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      EXISTS (
        SELECT 1
        FROM franqueados f
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
        AND f.unit_code ? ticket_unidade_id
      )
    ) OR
    (
      -- Colaboradores: apenas tickets de sua equipe
      has_role(auth.uid(), 'colaborador'::app_role) AND
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    ) OR
    (
      -- Outros membros de equipe (não colaboradores)
      NOT has_role(auth.uid(), 'colaborador'::app_role) AND
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$$;

-- Atualizar política de tickets para usar a função atualizada
DROP POLICY IF EXISTS "Users can view tickets based on permissions and team access" ON tickets;
CREATE POLICY "Users can view tickets based on permissions and team access"
ON tickets
FOR SELECT USING (can_view_ticket(unidade_id, equipe_responsavel_id));

-- Garantir que colaboradores possam responder apenas tickets de sua equipe
CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      has_role(auth.uid(), 'supervisor'::app_role) AND
      EXISTS (
        SELECT 1
        FROM franqueados f
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
        AND f.unit_code ? ticket_unidade_id
      )
    ) OR
    (
      -- Colaboradores: apenas tickets de sua equipe
      has_role(auth.uid(), 'colaborador'::app_role) AND
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    ) OR
    (
      -- Outros membros de equipe
      NOT has_role(auth.uid(), 'colaborador'::app_role) AND
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$$;