-- Remover política antiga que só permite atualizar tickets já na equipe
DROP POLICY IF EXISTS "tickets_team_members_update" ON public.tickets;

-- Nova política: membros podem atualizar tickets da sua equipe OU atribuir para sua equipe
CREATE POLICY "tickets_team_members_update"
ON public.tickets
FOR UPDATE
USING (
  -- Pode atualizar se o ticket JÁ está na sua equipe
  is_active_member_of_equipe(auth.uid(), equipe_responsavel_id)
  OR
  -- OU se tem permissão respond_tickets (necessário para atribuir tickets)
  has_permission(auth.uid(), 'respond_tickets'::app_permission)
)
WITH CHECK (
  -- Pode atribuir o ticket PARA sua equipe
  is_active_member_of_equipe(auth.uid(), equipe_responsavel_id)
  OR
  -- OU se tem permissão respond_tickets
  has_permission(auth.uid(), 'respond_tickets'::app_permission)
);