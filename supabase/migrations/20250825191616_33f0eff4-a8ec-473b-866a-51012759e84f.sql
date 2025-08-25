-- Desabilitar RLS e remover todas as políticas da tabela unidades para corrigir recursão infinita
ALTER TABLE public.unidades DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes da tabela unidades
DROP POLICY IF EXISTS "unidades_admin_all" ON public.unidades;
DROP POLICY IF EXISTS "unidades_diretoria_all" ON public.unidades;
DROP POLICY IF EXISTS "unidades_authenticated_select" ON public.unidades;

-- Reabilitar RLS
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

-- Criar políticas simples sem usar has_role para evitar recursão
CREATE POLICY "unidades_select_all" ON public.unidades
  FOR SELECT USING (true);

CREATE POLICY "unidades_admin_manage" ON public.unidades
  FOR ALL USING (
    auth.uid() IS NOT NULL AND 
    EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'admin'::app_role
    )
  );