-- HABILITAR RLS EM TODAS AS TABELAS DO SCHEMA PUBLIC
DO $$
DECLARE
    table_name TEXT;
    tables_with_rls TEXT[] := '{}';
    tables_without_rls TEXT[] := '{}';
BEGIN
    -- Listar todas as tabelas e habilitar RLS
    FOR table_name IN 
        SELECT t.tablename 
        FROM pg_tables t
        WHERE t.schemaname = 'public'
    LOOP
        -- Verificar se RLS já está habilitado
        IF EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = table_name 
            AND n.nspname = 'public'
            AND c.relrowsecurity = true
        ) THEN
            tables_with_rls := array_append(tables_with_rls, table_name);
        ELSE
            -- Habilitar RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
            tables_without_rls := array_append(tables_without_rls, table_name);
            RAISE NOTICE 'RLS HABILITADO: %', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'TOTAL TABELAS COM RLS: %', array_length(tables_with_rls, 1);
    RAISE NOTICE 'TOTAL TABELAS QUE RECEBERAM RLS: %', array_length(tables_without_rls, 1);
END $$;

-- CRIAR POLÍTICAS PADRÃO PARA TABELAS SEM POLÍTICAS
DO $$
DECLARE
    table_name TEXT;
    policy_count INTEGER;
    tables_updated INTEGER := 0;
BEGIN
    FOR table_name IN 
        SELECT t.tablename 
        FROM pg_tables t
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename
    LOOP
        -- Contar políticas existentes
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = table_name;
        
        -- Se não tem políticas, criar política restritiva padrão
        IF policy_count = 0 THEN
            EXECUTE format('CREATE POLICY "admin_only_access_%s" ON public.%I 
                           FOR ALL USING (has_role(auth.uid(), ''admin''::app_role))
                           WITH CHECK (has_role(auth.uid(), ''admin''::app_role))', 
                          table_name, table_name);
            tables_updated := tables_updated + 1;
            RAISE NOTICE 'POLÍTICA ADMIN CRIADA: % (total: %)', table_name, tables_updated;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'TOTAL DE TABELAS QUE RECEBERAM POLÍTICAS: %', tables_updated;
END $$;