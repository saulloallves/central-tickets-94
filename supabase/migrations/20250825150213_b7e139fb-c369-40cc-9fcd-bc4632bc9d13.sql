-- Atualizar função handle_new_user para atribuir role baseado nos metadados
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role TEXT;
BEGIN
  -- Inserir profile
  INSERT INTO public.profiles (id, nome_completo, email, telefone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'nome_completo',
    NEW.email,
    NEW.raw_user_meta_data ->> 'telefone'
  );
  
  -- Verificar se foi especificado um role nos metadados
  user_role := NEW.raw_user_meta_data ->> 'role';
  
  -- Se foi especificado um role válido, atribuir ao usuário
  IF user_role IS NOT NULL AND user_role IN ('admin', 'diretoria', 'supervisor', 'colaborador') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, user_role::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log da atribuição automática de role
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'user_roles',
      NEW.id::TEXT,
      'Role atribuído automaticamente durante cadastro',
      NEW.id,
      NULL, NULL, NULL,
      NULL,
      jsonb_build_object('email', NEW.email, 'role', user_role),
      'web'::public.log_canal
    );
  ELSE
    -- Se não especificou role ou é inválido, atribuir como colaborador por padrão
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'colaborador'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Log da atribuição padrão
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'user_roles',
      NEW.id::TEXT,
      'Role padrão de colaborador atribuído',
      NEW.id,
      NULL, NULL, NULL,
      NULL,
      jsonb_build_object('email', NEW.email, 'role', 'colaborador'),
      'web'::public.log_canal
    );
  END IF;
  
  RETURN NEW;
END;
$function$;