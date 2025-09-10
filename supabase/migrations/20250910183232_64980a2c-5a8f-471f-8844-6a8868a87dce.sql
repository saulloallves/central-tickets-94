-- Adicionar coluna approved na tabela user_roles
ALTER TABLE public.user_roles ADD COLUMN approved boolean NOT NULL DEFAULT false;

-- Criar função para aprovar acesso interno
CREATE OR REPLACE FUNCTION public.approve_internal_access(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request internal_access_requests%ROWTYPE;
BEGIN
  -- Buscar a solicitação
  SELECT * INTO v_request
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
  
  -- Aprovar a role do usuário (se já existir) ou criar aprovada
  INSERT INTO user_roles (user_id, role, approved)
  VALUES (v_request.user_id, 'colaborador'::app_role, true)
  ON CONFLICT (user_id, role) 
  DO UPDATE SET approved = true;
  
  -- Adicionar usuário à equipe
  INSERT INTO equipe_members (user_id, equipe_id, role, ativo)
  VALUES (v_request.user_id, v_request.equipe_id, v_request.desired_role, true)
  ON CONFLICT (user_id, equipe_id) 
  DO UPDATE SET 
    role = v_request.desired_role,
    ativo = true,
    updated_at = now();
  
  -- Log da ação
  PERFORM log_system_action(
    'sistema'::log_tipo,
    'internal_access_requests',
    p_request_id::TEXT,
    'Solicitação de acesso aprovada',
    auth.uid(),
    NULL, NULL, NULL, NULL,
    jsonb_build_object('user_id', v_request.user_id, 'equipe_id', v_request.equipe_id, 'desired_role', v_request.desired_role),
    'web'::log_canal
  );
END;
$$;

-- Criar função para rejeitar acesso interno
CREATE OR REPLACE FUNCTION public.reject_internal_access(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request internal_access_requests%ROWTYPE;
BEGIN
  -- Buscar a solicitação
  SELECT * INTO v_request
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
      comments = p_reason,
      updated_at = now()
  WHERE id = p_request_id;
  
  -- Remover a role não aprovada do usuário
  DELETE FROM user_roles 
  WHERE user_id = v_request.user_id 
    AND role = 'colaborador'::app_role 
    AND approved = false;
  
  -- Log da ação
  PERFORM log_system_action(
    'sistema'::log_tipo,
    'internal_access_requests',
    p_request_id::TEXT,
    'Solicitação de acesso rejeitada',
    auth.uid(),
    NULL, NULL, NULL, NULL,
    jsonb_build_object('user_id', v_request.user_id, 'equipe_id', v_request.equipe_id, 'reason', p_reason),
    'web'::log_canal
  );
END;
$$;

-- Atualizar função has_role para verificar se role está aprovada
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND approved = true  -- Só considera roles aprovadas
  )
$$;