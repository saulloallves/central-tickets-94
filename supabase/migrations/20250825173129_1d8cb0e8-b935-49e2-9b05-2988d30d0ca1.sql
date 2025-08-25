-- First, recreate the app_role enum properly
DO $$ 
BEGIN
    -- Drop and recreate the enum type
    DROP TYPE IF EXISTS app_role CASCADE;
    CREATE TYPE app_role AS ENUM (
        'admin',
        'diretoria', 
        'supervisor',
        'colaborador',
        'juridico',
        'financeiro'
    );

    -- Update the user_roles table to use the new enum
    ALTER TABLE public.user_roles 
    ALTER COLUMN role TYPE app_role USING role::text::app_role;

EXCEPTION 
    WHEN OTHERS THEN
        -- If there's an issue, let's update any 'gerente' values first
        UPDATE public.user_roles SET role = 'supervisor' WHERE role::text = 'gerente';
        
        -- Then recreate the enum
        DROP TYPE IF EXISTS app_role CASCADE;
        CREATE TYPE app_role AS ENUM (
            'admin',
            'diretoria', 
            'supervisor',
            'colaborador',
            'juridico',
            'financeiro'
        );
        
        ALTER TABLE public.user_roles 
        ALTER COLUMN role TYPE app_role USING role::text::app_role;
END $$;