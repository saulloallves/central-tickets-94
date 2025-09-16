-- Função melhorada para limpeza manual de usuários do auth
CREATE OR REPLACE FUNCTION public.get_all_users_except_current()
RETURNS TABLE(user_id uuid, user_email text, user_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  -- Verificar se o usuário atual é admin ou diretoria
  IF NOT (has_role(current_user_id, 'admin'::app_role) OR has_role(current_user_id, 'diretoria'::app_role)) THEN
    RAISE EXCEPTION 'Apenas administradores e diretoria podem executar esta operação';
  END IF;

  -- Retornar todos os usuários exceto o atual
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email as user_email,
    p.nome_completo as user_name
  FROM profiles p
  WHERE p.id != current_user_id;
END;
$$;