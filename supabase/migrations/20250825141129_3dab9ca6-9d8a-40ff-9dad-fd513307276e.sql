-- Executar correção novamente para colaboradores e franqueados existentes
SELECT public.fix_missing_colaborador_roles();
SELECT public.fix_missing_franqueado_roles();

-- Criar função para atribuir role básico para usuários que não são colaboradores nem franqueados
CREATE OR REPLACE FUNCTION public.assign_basic_user_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_record RECORD;
  roles_assigned INTEGER := 0;
BEGIN
  -- Iterar sobre usuários que não têm role e não são colaboradores nem franqueados
  FOR user_record IN 
    SELECT p.id, p.nome_completo, p.email
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    LEFT JOIN public.colaboradores c ON c.email = p.email
    LEFT JOIN public.franqueados f ON f.email = p.email
    WHERE ur.user_id IS NULL 
    AND c.email IS NULL 
    AND f.email IS NULL
  LOOP
    -- Atribuir role básico de colaborador para usuários que têm perfil mas não estão nas tabelas específicas
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_record.id, 'colaborador'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    roles_assigned := roles_assigned + 1;
    
    -- Log da ação
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'user_roles',
      user_record.id::TEXT,
      'Role básico de colaborador atribuído para usuário sem classificação',
      NULL,
      NULL, NULL, NULL,
      NULL,
      jsonb_build_object('email', user_record.email, 'nome', user_record.nome_completo, 'role', 'colaborador'),
      'web'::public.log_canal
    );
  END LOOP;
  
  -- Log resumo
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'user_roles',
    'bulk_assign_basic',
    'Atribuição em massa de roles básicos',
    NULL,
    NULL, NULL, NULL,
    NULL,
    jsonb_build_object('roles_assigned', roles_assigned),
    'web'::public.log_canal
  );
END;
$$;

-- Executar a função
SELECT public.assign_basic_user_roles();

-- Criar função automática para novos perfis sem classificação
CREATE OR REPLACE FUNCTION public.auto_assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_colaborador BOOLEAN := false;
  is_franqueado BOOLEAN := false;
BEGIN
  -- Verificar se o usuário é colaborador ou franqueado
  SELECT EXISTS(SELECT 1 FROM public.colaboradores WHERE email = NEW.email) INTO is_colaborador;
  SELECT EXISTS(SELECT 1 FROM public.franqueados WHERE email = NEW.email) INTO is_franqueado;
  
  -- Se não é nem colaborador nem franqueado, atribuir role básico de colaborador
  IF NOT is_colaborador AND NOT is_franqueado THEN
    -- Aguardar um pouco para garantir que o perfil foi criado
    PERFORM pg_sleep(0.1);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'colaborador'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log da ação
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'user_roles',
      NEW.id::TEXT,
      'Role padrão de colaborador atribuído automaticamente',
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

-- Criar trigger para novos perfis
DROP TRIGGER IF EXISTS trigger_auto_assign_default_role ON public.profiles;
CREATE TRIGGER trigger_auto_assign_default_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_default_role();