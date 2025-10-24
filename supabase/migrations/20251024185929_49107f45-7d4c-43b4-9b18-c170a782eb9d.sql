-- Permitir admins e diretoria gerenciar todos os planos de ação
CREATE POLICY "admins_diretoria_manage_plano_acao" 
ON public.plano_acao 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'diretoria'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'diretoria'::app_role)
);

-- Permitir colaboradores visualizarem planos de ação
CREATE POLICY "colaboradores_view_plano_acao" 
ON public.plano_acao 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'colaborador'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'diretoria'::app_role)
);

-- Permitir franqueados visualizarem planos de ação de suas unidades
CREATE POLICY "franqueados_view_own_plano_acao" 
ON public.plano_acao 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'franqueado'::app_role) AND
  codigo_grupo IN (
    SELECT u.codigo_grupo::bigint
    FROM unidades u
    INNER JOIN franqueados_unidades fu ON u.id = fu.unidade_id
    INNER JOIN franqueados f ON fu.franqueado_id = f.id
    INNER JOIN profiles p ON f.email = p.email
    WHERE p.id = auth.uid()
  )
);

-- Habilitar RLS
ALTER TABLE plano_acao ENABLE ROW LEVEL SECURITY;