-- Create policy to allow team members to update tickets
-- Using existing is_active_member_of_equipe function
CREATE POLICY "tickets_team_members_update"
ON public.tickets
FOR UPDATE
USING (
  is_active_member_of_equipe(auth.uid(), equipe_responsavel_id)
)
WITH CHECK (
  is_active_member_of_equipe(auth.uid(), equipe_responsavel_id)
);