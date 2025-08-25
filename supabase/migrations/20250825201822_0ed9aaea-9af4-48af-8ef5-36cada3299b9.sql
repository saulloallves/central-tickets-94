
-- 1) Criar ENUM app_role caso não exista (com todos os papéis usados no app e nas políticas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.app_role AS ENUM (
      'admin',
      'supervisor',
      'diretor',
      'diretoria',
      'colaborador',
      'gestor_equipe',
      'gestor_unidade',
      'franqueado',
      'auditor_juridico',
      'gerente',
      'juridico'  -- usado nas políticas de logs
    );
  END IF;
END
$$;

-- 2) Garantir que user_roles.role use o tipo app_role (se hoje for TEXT ou outro)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'role'
      AND udt_name <> 'app_role'
  ) THEN
    -- IMPORTANTE: isso assume que os valores atuais em user_roles.role
    -- estão no conjunto do ENUM. Se houver valores fora da lista,
    -- o comando abaixo falhará. Nesse caso, vamos mapear manualmente depois.
    ALTER TABLE public.user_roles
      ALTER COLUMN role TYPE public.app_role
      USING role::public.app_role;
  END IF;
END
$$;

-- 3) Atualizar a função que roda no signup para NÃO inserir roles automáticos
CREATE OR REPLACE FUNCTION public.handle_auth_user_new()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Garante criação de perfil
  INSERT INTO public.profiles (id, email, nome_completo, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Sistema'),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nome_completo = EXCLUDED.nome_completo,
        updated_at = now();

  -- Removido: NÃO atribuir papéis por padrão (evita erro se o ENUM não existe e evita dar admin a todos)
  -- Caso precise atribuir papéis, faça isso por um fluxo explícito pós-criação.

  RETURN NEW;
END;
$function$;
