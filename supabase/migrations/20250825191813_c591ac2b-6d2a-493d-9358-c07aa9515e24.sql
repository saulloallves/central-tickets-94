-- Corrigir definitivamente o problema de recursão infinita na tabela unidades
-- Remover completamente todas as políticas e recriar de forma simples

-- Desabilitar RLS temporariamente
ALTER TABLE public.unidades DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "unidades_select_all" ON public.unidades;
DROP POLICY IF EXISTS "unidades_admin_manage" ON public.unidades;
DROP POLICY IF EXISTS "unidades_admin_all" ON public.unidades;
DROP POLICY IF EXISTS "unidades_diretoria_all" ON public.unidades;
DROP POLICY IF EXISTS "unidades_authenticated_select" ON public.unidades;

-- Reabilitar RLS
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

-- Criar política super simples para permitir tudo para usuários autenticados
CREATE POLICY "unidades_allow_all_authenticated" ON public.unidades
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Verificar se a política de tickets também precisa ser simplificada
DROP POLICY IF EXISTS "tickets_admin_all" ON public.tickets;
DROP POLICY IF EXISTS "tickets_authenticated_select" ON public.tickets;

-- Recriar política simples para tickets
CREATE POLICY "tickets_allow_all_authenticated" ON public.tickets
  FOR ALL USING (auth.uid() IS NOT NULL);