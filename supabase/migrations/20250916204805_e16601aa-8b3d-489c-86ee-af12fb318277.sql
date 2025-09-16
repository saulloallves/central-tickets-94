-- 1. Criar funções RPC para aprovação/rejeição de solicitações de acesso interno
CREATE OR REPLACE FUNCTION public.approve_internal_access(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Buscar dados da solicitação
  SELECT user_id, equipe_id, desired_role 
  INTO v_request
  FROM internal_access_requests 
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já processada';
  END IF;
  
  -- Atualizar status da solicitação
  UPDATE internal_access_requests 
  SET status = 'approved',
      decided_by = auth.uid(),
      decided_at = now(),
      updated_at = now()
  WHERE id = p_request_id;
  
  -- Adicionar usuário à equipe
  INSERT INTO equipe_members (user_id, equipe_id, role, ativo)
  VALUES (v_request.user_id, v_request.equipe_id, v_request.desired_role, true)
  ON CONFLICT (user_id, equipe_id) DO UPDATE SET
    role = EXCLUDED.role,
    ativo = true,
    updated_at = now();
  
  -- Marcar role de colaborador como aprovado
  UPDATE user_roles 
  SET approved = true, updated_at = now()
  WHERE user_id = v_request.user_id AND role = 'colaborador'::app_role;
  
  -- Se não existir role de colaborador, criar com approved = true
  INSERT INTO user_roles (user_id, role, approved)
  VALUES (v_request.user_id, 'colaborador'::app_role, true)
  ON CONFLICT (user_id, role) DO UPDATE SET
    approved = true,
    updated_at = now();
    
  -- Log da aprovação
  PERFORM log_system_action(
    'acao_humana'::log_tipo,
    'internal_access_requests',
    p_request_id::TEXT,
    'Solicitação de acesso aprovada',
    auth.uid(),
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'user_id', v_request.user_id, 
      'equipe_id', v_request.equipe_id,
      'role', v_request.desired_role
    ),
    'web'::log_canal
  );
END;
$$;

-- 2. Função para rejeitar solicitação
CREATE OR REPLACE FUNCTION public.reject_internal_access(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Buscar dados da solicitação
  SELECT user_id, equipe_id 
  INTO v_request
  FROM internal_access_requests 
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já processada';
  END IF;
  
  -- Atualizar status da solicitação
  UPDATE internal_access_requests 
  SET status = 'rejected',
      decided_by = auth.uid(),
      decided_at = now(),
      updated_at = now(),
      comments = p_reason
  WHERE id = p_request_id;
  
  -- Log da rejeição
  PERFORM log_system_action(
    'acao_humana'::log_tipo,
    'internal_access_requests',
    p_request_id::TEXT,
    'Solicitação de acesso rejeitada',
    auth.uid(),
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'user_id', v_request.user_id, 
      'equipe_id', v_request.equipe_id,
      'reason', p_reason
    ),
    'web'::log_canal
  );
END;
$$;

-- 3. Trigger para garantir que profiles tenham nome_completo
CREATE OR REPLACE FUNCTION public.ensure_profile_nome_completo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se nome_completo estiver vazio ou null, usar o email como base
  IF NEW.nome_completo IS NULL OR trim(NEW.nome_completo) = '' THEN
    NEW.nome_completo := COALESCE(
      NEW.email,
      'Usuário ' || substring(NEW.id::text, 1, 8)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para novos profiles
DROP TRIGGER IF EXISTS ensure_profile_nome_completo_trigger ON profiles;
CREATE TRIGGER ensure_profile_nome_completo_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_profile_nome_completo();

-- 4. Corrigir profiles existentes sem nome_completo
UPDATE profiles 
SET nome_completo = COALESCE(email, 'Usuário ' || substring(id::text, 1, 8))
WHERE nome_completo IS NULL OR trim(nome_completo) = '';

-- 5. Adicionar constraint para garantir nome_completo não vazio
ALTER TABLE profiles 
ADD CONSTRAINT profiles_nome_completo_not_empty 
CHECK (nome_completo IS NOT NULL AND trim(nome_completo) != '');

-- 6. Função para refresh de permissions após aprovação
CREATE OR REPLACE FUNCTION public.refresh_user_permissions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_roles_data jsonb;
  user_permissions_data jsonb;
BEGIN
  -- Buscar roles aprovadas do usuário
  SELECT json_agg(
    json_build_object(
      'role', role,
      'approved', approved
    )
  ) INTO user_roles_data
  FROM user_roles 
  WHERE user_id = p_user_id;
  
  -- Buscar permissões do usuário
  SELECT json_agg(DISTINCT permission) INTO user_permissions_data
  FROM get_user_permissions(p_user_id) AS permission;
  
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'roles', COALESCE(user_roles_data, '[]'::jsonb),
    'permissions', COALESCE(user_permissions_data, '[]'::jsonb),
    'timestamp', now()
  );
END;
$$;