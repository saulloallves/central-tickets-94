-- Habilitar RLS em TODAS as tabelas restantes que ainda não têm
DO $$
DECLARE
    table_record RECORD;
BEGIN
    -- Habilitar RLS em todas as tabelas do schema public que não têm RLS ativo
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = tablename 
            AND n.nspname = schemaname
            AND c.relrowsecurity = true
        )
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 
                      table_record.schemaname, table_record.tablename);
        
        RAISE NOTICE 'RLS habilitado para tabela: %.%', 
                     table_record.schemaname, table_record.tablename;
    END LOOP;
END $$;

-- Criar políticas básicas de segurança para tabelas sem políticas
-- Estas são políticas restritivas por padrão que podem ser refinadas depois

-- Para tabelas de dados do sistema que devem ser apenas para admins
DO $$
DECLARE
    admin_only_tables TEXT[] := ARRAY[
        'unidades', 'view_access_log', 'users'
    ];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY admin_only_tables
    LOOP
        -- Só criar política se a tabela existir e não tiver políticas
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name) 
        AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name) THEN
            
            EXECUTE format('CREATE POLICY "Admin only access" ON public.%I 
                           FOR ALL USING (has_role(auth.uid(), ''admin''::app_role))
                           WITH CHECK (has_role(auth.uid(), ''admin''::app_role))', table_name);
                           
            RAISE NOTICE 'Política admin criada para: %', table_name;
        END IF;
    END LOOP;
END $$;

-- Para tabelas que devem permitir leitura autenticada mas inserção/modificação restrita
DO $$
DECLARE
    read_authenticated_tables TEXT[] := ARRAY[
        'tickets', 'ticket_mensagens'
    ];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY read_authenticated_tables
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name) 
        AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name) THEN
            
            EXECUTE format('CREATE POLICY "Authenticated read access" ON public.%I 
                           FOR SELECT USING (auth.uid() IS NOT NULL)', table_name);
                           
            EXECUTE format('CREATE POLICY "Admin modify access" ON public.%I 
                           FOR INSERT WITH CHECK (has_role(auth.uid(), ''admin''::app_role))', table_name);
                           
            EXECUTE format('CREATE POLICY "Admin update access" ON public.%I 
                           FOR UPDATE USING (has_role(auth.uid(), ''admin''::app_role))
                           WITH CHECK (has_role(auth.uid(), ''admin''::app_role))', table_name);
                           
            EXECUTE format('CREATE POLICY "Admin delete access" ON public.%I 
                           FOR DELETE USING (has_role(auth.uid(), ''admin''::app_role))', table_name);
                           
            RAISE NOTICE 'Políticas de leitura autenticada criadas para: %', table_name;
        END IF;
    END LOOP;
END $$;

-- Para todas as outras tabelas sem políticas, criar uma política muito restritiva
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = table_record.tablename
        )
        AND tablename NOT IN ('unidades', 'view_access_log', 'users', 'tickets', 'ticket_mensagens')
    LOOP
        -- Política muito restritiva: apenas admins podem fazer qualquer coisa
        EXECUTE format('CREATE POLICY "Default admin only" ON public.%I 
                       FOR ALL USING (has_role(auth.uid(), ''admin''::app_role))
                       WITH CHECK (has_role(auth.uid(), ''admin''::app_role))', 
                      table_record.tablename);
                      
        RAISE NOTICE 'Política restritiva padrão criada para: %', table_record.tablename;
    END LOOP;
END $$;