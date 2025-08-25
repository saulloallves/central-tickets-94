-- Corrigir recursão infinita restante nas policies RLS

-- Habilitar RLS na tabela profiles caso não esteja habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover todas as policies existentes da tabela profiles
DROP POLICY IF EXISTS "Admins and diretoria can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and diretoria can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles linked to visible tickets" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Criar policies simples e diretas para profiles
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "profiles_diretoria_all" ON public.profiles
  FOR ALL USING (has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "profiles_own_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Remover qualquer policy restante problemática de tickets
DROP POLICY IF EXISTS "Users view tickets for accessible tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can view tickets for accessible tickets" ON public.tickets;

-- Verificar se todas as tables críticas têm RLS habilitado
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_mensagens ENABLE ROW LEVEL SECURITY;

-- Criar policy adicional para ticket_mensagens se necessário
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ticket_mensagens' 
    AND policyname = 'ticket_mensagens_admin_all'
  ) THEN
    EXECUTE 'CREATE POLICY "ticket_mensagens_admin_all" ON public.ticket_mensagens
      FOR ALL USING (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;