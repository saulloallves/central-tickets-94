-- Adicionar RLS policy para verificar email confirmado nas solicitações de acesso interno
CREATE POLICY "Internal access requests require confirmed email"
ON public.internal_access_requests
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email_confirmed_at IS NOT NULL
  )
);

-- Função para limpar solicitações de acesso de usuários não confirmados
CREATE OR REPLACE FUNCTION public.cleanup_unconfirmed_access_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Deletar solicitações de usuários não confirmados
  DELETE FROM public.internal_access_requests
  WHERE user_id IN (
    SELECT u.id 
    FROM auth.users u
    WHERE u.email_confirmed_at IS NULL
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log da limpeza
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'internal_access_requests',
    'cleanup',
    'Limpeza de solicitações de usuários não confirmados',
    NULL,
    NULL, NULL, NULL, NULL,
    jsonb_build_object('deleted_count', deleted_count),
    'web'::public.log_canal
  );
  
  RETURN deleted_count;
END;
$$;

-- Função para verificar e alertar sobre usuários não confirmados
CREATE OR REPLACE FUNCTION public.monitor_unconfirmed_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  unconfirmed_count INTEGER := 0;
  with_requests_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Contar usuários não confirmados
  SELECT COUNT(*) INTO unconfirmed_count
  FROM auth.users
  WHERE email_confirmed_at IS NULL
    AND created_at > now() - interval '7 days';
  
  -- Contar usuários não confirmados com solicitações
  SELECT COUNT(DISTINCT iar.user_id) INTO with_requests_count
  FROM public.internal_access_requests iar
  JOIN auth.users u ON u.id = iar.user_id
  WHERE u.email_confirmed_at IS NULL;
  
  result := jsonb_build_object(
    'unconfirmed_users_last_7_days', unconfirmed_count,
    'unconfirmed_with_access_requests', with_requests_count,
    'checked_at', now()
  );
  
  -- Log do monitoramento
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'auth_monitoring',
    'check',
    'Monitoramento de usuários não confirmados',
    NULL,
    NULL, NULL, NULL, NULL,
    result,
    'web'::public.log_canal
  );
  
  RETURN result;
END;
$$;