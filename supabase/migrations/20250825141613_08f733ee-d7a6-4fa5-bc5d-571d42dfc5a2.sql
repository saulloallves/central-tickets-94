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
    
    RAISE NOTICE 'TABELAS COM RLS: %', tables_with_rls;
    RAISE NOTICE 'TABELAS QUE RECEBERAM RLS: %', tables_without_rls;
END $$;

-- CRIAR POLÍTICAS PADRÃO PARA TABELAS SEM POLÍTICAS
DO $$
DECLARE
    table_name TEXT;
    policy_count INTEGER;
BEGIN
    FOR table_name IN 
        SELECT t.tablename 
        FROM pg_tables t
        WHERE t.schemaname = 'public'
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
            RAISE NOTICE 'POLÍTICA CRIADA PARA: %', table_name;
        END IF;
    END LOOP;
END $$;

-- FUNÇÕES ESSENCIAIS MISSING
-- Criar função can_view_ticket se não existir
CREATE OR REPLACE FUNCTION public.can_view_ticket(_unidade_id text, _equipe_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
    (
      has_role(auth.uid(), 'gerente'::app_role) AND
      EXISTS (
        SELECT 1
        FROM franqueados f
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
        AND f.unit_code ? _unidade_id
      )
    ) OR
    (
      _equipe_id IS NOT NULL AND
      is_active_member_of_equipe(auth.uid(), _equipe_id)
    ) OR
    (
      _unidade_id IN (
        SELECT c.unidade_id
        FROM colaboradores c
        JOIN profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    )
$$;