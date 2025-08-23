
-- Corrigir RLS nas relações usadas pelo hook useTickets
-- para destravar o Relatórios de Uso

-- 1) Perfis (profiles) visíveis apenas quando vinculados a tickets
-- que o usuário tem permissão de visualizar
DROP POLICY IF EXISTS "Users can view profiles linked to visible tickets" ON public.profiles;

CREATE POLICY "Users can view profiles linked to visible tickets"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE (t.criado_por = profiles.id OR t.atendimento_iniciado_por = profiles.id)
      AND public.can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
  )
);

-- 2) Colaboradores visíveis quando vinculados a tickets
-- que o usuário tem permissão de visualizar
DROP POLICY IF EXISTS "Users can view colaboradores linked to visible tickets" ON public.colaboradores;

CREATE POLICY "Users can view colaboradores linked to visible tickets"
ON public.colaboradores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.colaborador_id = colaboradores.id
      AND public.can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
  )
);
