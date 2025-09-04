-- Atualizar função can_view_ticket para colaboradores verem apenas tickets da sua equipe
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admins podem ver todos
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'diretoria'::app_role) OR
    -- Usuários com permissão específica
    has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      -- Supervisores/Gerentes podem ver tickets das suas unidades
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
      -- Colaboradores: APENAS tickets onde a equipe responsável é a sua equipe
      has_role(auth.uid(), 'colaborador'::app_role) AND
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    ) OR
    (
      -- Outros membros de equipe que não são colaboradores
      NOT has_role(auth.uid(), 'colaborador'::app_role) AND
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$$;