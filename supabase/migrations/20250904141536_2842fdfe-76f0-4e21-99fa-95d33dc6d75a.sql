-- Dar permissão view_team_tickets para colaboradores
INSERT INTO public.role_permissions (role, permission) VALUES 
  ('colaborador', 'view_team_tickets')
ON CONFLICT (role, permission) DO NOTHING;

-- Atualizar políticas RLS para colaboradores

-- Política para equipes - colaboradores podem ver todas as equipes
DROP POLICY IF EXISTS "Colaboradores can view equipes" ON public.equipes;
CREATE POLICY "Colaboradores can view equipes" 
ON public.equipes 
FOR SELECT 
USING (
  has_role(auth.uid(), 'colaborador'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'diretoria'::app_role) OR
  ativo = true
);

-- Política para franqueados - colaboradores podem ver todos
DROP POLICY IF EXISTS "Colaboradores view all franqueados" ON public.franqueados;
CREATE POLICY "Colaboradores view all franqueados" 
ON public.franqueados 
FOR SELECT 
USING (
  has_role(auth.uid(), 'colaborador'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'diretoria'::app_role) OR
  has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
  ((auth.uid())::text IN ( SELECT (p.id)::text AS id
     FROM profiles p
    WHERE (p.email = franqueados.email)))
);

-- Política para unidades - colaboradores podem ver todas
DROP POLICY IF EXISTS "Colaboradores view all unidades" ON public.unidades;
CREATE POLICY "Colaboradores view all unidades" 
ON public.unidades 
FOR SELECT 
USING (
  has_role(auth.uid(), 'colaborador'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  auth.uid() IS NOT NULL
);