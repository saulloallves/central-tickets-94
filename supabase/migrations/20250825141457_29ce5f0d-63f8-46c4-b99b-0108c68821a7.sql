-- Habilitar RLS em tabelas específicas que ainda não têm
ALTER TABLE IF EXISTS public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.view_access_log ENABLE ROW LEVEL SECURITY;

-- Criar políticas básicas para unidades
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'unidades' AND policyname = 'Admin manage unidades') THEN
        CREATE POLICY "Admin manage unidades" ON public.unidades
        FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
        WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'unidades' AND policyname = 'Authenticated view unidades') THEN
        CREATE POLICY "Authenticated view unidades" ON public.unidades
        FOR SELECT USING (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Criar políticas para view_access_log
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'view_access_log' AND policyname = 'Admin view access logs') THEN
        CREATE POLICY "Admin view access logs" ON public.view_access_log
        FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'view_access_log' AND policyname = 'System insert access logs') THEN
        CREATE POLICY "System insert access logs" ON public.view_access_log
        FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- Políticas melhoradas para tickets (sobrescrevendo as políticas básicas)
DROP POLICY IF EXISTS "Authenticated read access" ON public.tickets;
DROP POLICY IF EXISTS "Admin modify access" ON public.tickets;
DROP POLICY IF EXISTS "Admin update access" ON public.tickets;
DROP POLICY IF EXISTS "Admin delete access" ON public.tickets;

-- Criar políticas mais adequadas para tickets
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tickets' AND policyname = 'Users can view tickets they have access to') THEN
        CREATE POLICY "Users can view tickets they have access to" ON public.tickets
        FOR SELECT USING (can_view_ticket(unidade_id, equipe_responsavel_id));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tickets' AND policyname = 'Users can create tickets for allowed units') THEN
        CREATE POLICY "Users can create tickets for allowed units" ON public.tickets
        FOR INSERT WITH CHECK (can_create_ticket(unidade_id));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tickets' AND policyname = 'Users can update tickets they manage') THEN
        CREATE POLICY "Users can update tickets they manage" ON public.tickets
        FOR UPDATE USING (can_update_ticket(unidade_id, equipe_responsavel_id))
        WITH CHECK (can_update_ticket(unidade_id, equipe_responsavel_id));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tickets' AND policyname = 'Admins can delete tickets') THEN
        CREATE POLICY "Admins can delete tickets" ON public.tickets
        FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
    END IF;
END $$;

-- Melhorar políticas para ticket_mensagens
DROP POLICY IF EXISTS "Authenticated read access" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "Admin modify access" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "Admin update access" ON public.ticket_mensagens;
DROP POLICY IF EXISTS "Admin delete access" ON public.ticket_mensagens;