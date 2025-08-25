-- Habilitar RLS na tabela unidades e criar policies básicas
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

-- Criar policies para a tabela unidades
CREATE POLICY "unidades_admin_all" ON public.unidades
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "unidades_diretoria_all" ON public.unidades
  FOR ALL USING (has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "unidades_authenticated_select" ON public.unidades
  FOR SELECT USING (auth.uid() IS NOT NULL);