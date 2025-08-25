-- Criar dados de teste para resolver o problema imediatamente
-- Inserir um usuário admin de teste

-- Primeiro, vamos ver se há algum user no sistema
DO $$ 
DECLARE
    test_user_id UUID := '92d526f8-c52d-46e8-9b9d-161370dabce2'; -- ID fixo para teste
    test_email TEXT := 'admin@teste.com';
BEGIN
    -- Inserir perfil de admin teste
    INSERT INTO public.profiles (id, email, nome_completo, created_at, updated_at)
    VALUES (test_user_id, test_email, 'Administrador Teste', now(), now())
    ON CONFLICT (id) DO UPDATE SET
        nome_completo = 'Administrador Teste',
        email = test_email,
        updated_at = now();

    -- Inserir roles de admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES 
        (test_user_id, 'admin'::app_role),
        (test_user_id, 'diretoria'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'Admin de teste criado com ID: %', test_user_id;
END $$;