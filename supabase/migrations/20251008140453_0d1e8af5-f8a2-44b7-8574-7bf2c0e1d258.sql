-- Criar política RLS de SELECT para membros de equipes
CREATE POLICY "tickets_team_members_select"
ON public.tickets
FOR SELECT
TO public
USING (
  is_active_member_of_equipe(auth.uid(), equipe_responsavel_id)
);