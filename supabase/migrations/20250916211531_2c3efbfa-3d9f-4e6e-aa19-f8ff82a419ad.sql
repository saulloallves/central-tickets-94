-- Corrigir função approve_internal_access removendo referências à coluna updated_at na tabela user_roles
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
  
  -- Marcar role de colaborador como aprovado (removendo updated_at)
  UPDATE user_roles 
  SET approved = true
  WHERE user_id = v_request.user_id AND role = 'colaborador'::app_role;
  
  -- Se não existir role de colaborador, criar com approved = true (removendo updated_at)
  INSERT INTO user_roles (user_id, role, approved)
  VALUES (v_request.user_id, 'colaborador'::app_role, true)
  ON CONFLICT (user_id, role) DO UPDATE SET
    approved = true;
    
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