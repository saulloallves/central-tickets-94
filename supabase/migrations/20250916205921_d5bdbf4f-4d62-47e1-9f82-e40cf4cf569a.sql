-- Função para limpar todos os usuários exceto o atual
CREATE OR REPLACE FUNCTION public.cleanup_all_users_except_current()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  user_record RECORD;
  removed_count integer := 0;
  result jsonb;
BEGIN
  -- Verificar se o usuário atual é admin ou diretoria
  IF NOT (has_role(current_user_id, 'admin'::app_role) OR has_role(current_user_id, 'diretoria'::app_role)) THEN
    RAISE EXCEPTION 'Apenas administradores e diretoria podem executar limpeza de usuários';
  END IF;

  -- Log da ação crítica
  PERFORM log_system_action(
    'acao_humana'::log_tipo,
    'user_management',
    'cleanup_all_users',
    'Iniciando limpeza de todos os usuários exceto o atual',
    current_user_id,
    NULL, NULL, NULL, NULL,
    jsonb_build_object('current_user_id', current_user_id),
    'web'::log_canal
  );

  -- Buscar todos os usuários exceto o atual
  FOR user_record IN 
    SELECT id, email, nome_completo 
    FROM profiles 
    WHERE id != current_user_id
  LOOP
    BEGIN
      -- Remover cada usuário usando a função existente
      PERFORM remove_user_completely(user_record.id);
      removed_count := removed_count + 1;
      
      RAISE NOTICE 'Usuário removido: % (ID: %)', user_record.email, user_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao remover usuário %: %', user_record.email, SQLERRM;
    END;
  END LOOP;

  -- Log final
  PERFORM log_system_action(
    'acao_humana'::log_tipo,
    'user_management',
    'cleanup_all_users',
    'Limpeza de usuários concluída',
    current_user_id,
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'current_user_id', current_user_id,
      'removed_count', removed_count,
      'timestamp', now()
    ),
    'web'::log_canal
  );

  result := jsonb_build_object(
    'success', true,
    'current_user_id', current_user_id,
    'removed_count', removed_count,
    'message', 'Limpeza concluída com sucesso'
  );

  RETURN result;
END;
$$;