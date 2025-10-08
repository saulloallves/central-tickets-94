-- Corrigir política de UPDATE para permitir criação de tickets sem equipe
DROP POLICY IF EXISTS "tickets_team_members_update" ON public.tickets;

CREATE POLICY "tickets_team_members_update"
ON public.tickets
FOR UPDATE
USING (
  -- Pode atualizar se o ticket JÁ está na sua equipe (e equipe não é nula)
  (equipe_responsavel_id IS NOT NULL AND is_active_member_of_equipe(auth.uid(), equipe_responsavel_id))
  OR
  -- OU se tem permissão respond_tickets
  has_permission(auth.uid(), 'respond_tickets'::app_permission)
)
WITH CHECK (
  -- Pode atribuir o ticket PARA sua equipe (e equipe não é nula)
  (equipe_responsavel_id IS NOT NULL AND is_active_member_of_equipe(auth.uid(), equipe_responsavel_id))
  OR
  -- OU se tem permissão respond_tickets
  has_permission(auth.uid(), 'respond_tickets'::app_permission)
);