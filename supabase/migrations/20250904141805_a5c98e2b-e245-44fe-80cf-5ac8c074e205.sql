-- Criar função can_update_ticket para verificar permissões de update
CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id text, ticket_equipe_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admins podem atualizar todos
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'diretoria'::app_role) OR
    -- Usuários com permissão específica
    has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      -- Supervisores/Gerentes podem atualizar tickets das suas unidades
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
      -- Colaboradores: podem atualizar apenas tickets da sua equipe
      has_role(auth.uid(), 'colaborador'::app_role) AND
      ticket_equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$$;

-- Adicionar política de UPDATE para tickets usando a nova função
DROP POLICY IF EXISTS "Users can update tickets based on permissions" ON public.tickets;
CREATE POLICY "Users can update tickets based on permissions" 
ON public.tickets 
FOR UPDATE 
USING (can_update_ticket(unidade_id, equipe_responsavel_id))
WITH CHECK (can_update_ticket(unidade_id, equipe_responsavel_id));

-- Dar permissão respond_tickets para colaboradores para que possam atualizar tickets
INSERT INTO public.role_permissions (role, permission) VALUES 
  ('colaborador', 'respond_tickets')
ON CONFLICT (role, permission) DO NOTHING;