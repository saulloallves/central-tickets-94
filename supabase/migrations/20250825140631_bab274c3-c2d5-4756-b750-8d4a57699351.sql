-- Primeiro vamos verificar os valores válidos para o enum log_canal
-- Criar função para automaticamente atribuir role de colaborador quando um novo colaborador é criado
CREATE OR REPLACE FUNCTION public.auto_assign_colaborador_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_user_id UUID;
BEGIN
  -- Buscar o user_id do profile baseado no email do colaborador
  SELECT id INTO profile_user_id 
  FROM public.profiles 
  WHERE email = NEW.email;
  
  -- Se encontrou o user_id, atribuir role de colaborador
  IF profile_user_id IS NOT NULL THEN
    -- Inserir role de colaborador (se não existir)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (profile_user_id, 'colaborador'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log da ação
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'user_roles',
      profile_user_id::TEXT,
      'Role de colaborador atribuído automaticamente',
      NULL,
      NULL, NULL, NULL,
      NULL,
      jsonb_build_object('email', NEW.email, 'role', 'colaborador'),
      'web'::public.log_canal
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para colaboradores criados
CREATE TRIGGER trigger_auto_assign_colaborador_role
  AFTER INSERT ON public.colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_colaborador_role();

-- Criar função para automaticamente atribuir role de gerente quando um novo franqueado é criado  
CREATE OR REPLACE FUNCTION public.auto_assign_franqueado_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_user_id UUID;
BEGIN
  -- Buscar o user_id do profile baseado no email do franqueado
  SELECT id INTO profile_user_id 
  FROM public.profiles 
  WHERE email = NEW.email;
  
  -- Se encontrou o user_id, atribuir role de gerente
  IF profile_user_id IS NOT NULL THEN
    -- Inserir role de gerente (se não existir)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (profile_user_id, 'gerente'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log da ação
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'user_roles',
      profile_user_id::TEXT,
      'Role de gerente atribuído automaticamente',
      NULL,
      NULL, NULL, NULL,
      NULL,
      jsonb_build_object('email', NEW.email, 'role', 'gerente'),
      'web'::public.log_canal
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para franqueados criados
CREATE TRIGGER trigger_auto_assign_franqueado_role
  AFTER INSERT ON public.franqueados
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_franqueado_role();

-- Criar função para processar colaboradores existentes sem role
CREATE OR REPLACE FUNCTION public.fix_missing_colaborador_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  collab_record RECORD;
  profile_user_id UUID;
  roles_assigned INTEGER := 0;
BEGIN
  -- Iterar sobre colaboradores que não têm role definido
  FOR collab_record IN 
    SELECT c.email, c.nome_completo
    FROM public.colaboradores c
    LEFT JOIN public.profiles p ON p.email = c.email
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id IS NOT NULL 
    AND ur.user_id IS NULL
  LOOP
    -- Buscar o user_id do profile
    SELECT id INTO profile_user_id 
    FROM public.profiles 
    WHERE email = collab_record.email;
    
    IF profile_user_id IS NOT NULL THEN
      -- Inserir role de colaborador
      INSERT INTO public.user_roles (user_id, role)
      VALUES (profile_user_id, 'colaborador'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
      
      roles_assigned := roles_assigned + 1;
      
      -- Log da ação
      PERFORM public.log_system_action(
        'sistema'::public.log_tipo,
        'user_roles',
        profile_user_id::TEXT,
        'Role de colaborador corrigido retroativamente',
        NULL,
        NULL, NULL, NULL,
        NULL,
        jsonb_build_object('email', collab_record.email, 'nome', collab_record.nome_completo, 'role', 'colaborador'),
        'web'::public.log_canal
      );
    END IF;
  END LOOP;
  
  -- Log resumo
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'user_roles',
    'bulk_fix',
    'Correção em massa de roles de colaboradores',
    NULL,
    NULL, NULL, NULL,
    NULL,
    jsonb_build_object('roles_assigned', roles_assigned),
    'web'::public.log_canal
  );
END;
$$;

-- Criar função para processar franqueados existentes sem role
CREATE OR REPLACE FUNCTION public.fix_missing_franqueado_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  franq_record RECORD;
  profile_user_id UUID;
  roles_assigned INTEGER := 0;
BEGIN
  -- Iterar sobre franqueados que não têm role definido
  FOR franq_record IN 
    SELECT f.email, f.name
    FROM public.franqueados f
    LEFT JOIN public.profiles p ON p.email = f.email
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id IS NOT NULL 
    AND ur.user_id IS NULL
  LOOP
    -- Buscar o user_id do profile
    SELECT id INTO profile_user_id 
    FROM public.profiles 
    WHERE email = franq_record.email;
    
    IF profile_user_id IS NOT NULL THEN
      -- Inserir role de gerente
      INSERT INTO public.user_roles (user_id, role)
      VALUES (profile_user_id, 'gerente'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
      
      roles_assigned := roles_assigned + 1;
      
      -- Log da ação
      PERFORM public.log_system_action(
        'sistema'::public.log_tipo,
        'user_roles',
        profile_user_id::TEXT,
        'Role de gerente corrigido retroativamente',
        NULL,
        NULL, NULL, NULL,
        NULL,
        jsonb_build_object('email', franq_record.email, 'nome', franq_record.name, 'role', 'gerente'),
        'web'::public.log_canal
      );
    END IF;
  END LOOP;
  
  -- Log resumo
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'user_roles',
    'bulk_fix',
    'Correção em massa de roles de franqueados',
    NULL,
    NULL, NULL, NULL,
    NULL,
    jsonb_build_object('roles_assigned', roles_assigned),
    'web'::public.log_canal
  );
END;
$$;

-- Executar correção para colaboradores existentes
SELECT public.fix_missing_colaborador_roles();

-- Executar correção para franqueados existentes  
SELECT public.fix_missing_franqueado_roles();