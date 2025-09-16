-- Criar função para limpeza completa do usuário
CREATE OR REPLACE FUNCTION public.remove_user_completely(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log da ação
  PERFORM log_system_action(
    'acao_humana'::log_tipo,
    'user_management',
    p_user_id::TEXT,
    'Iniciando remoção completa do usuário',
    auth.uid(),
    NULL, NULL, NULL, NULL,
    jsonb_build_object('user_id', p_user_id),
    'web'::log_canal
  );

  -- 1. Remover knowledge_suggestions (causa foreign key constraint)
  DELETE FROM knowledge_suggestions WHERE sugerido_por = p_user_id;
  
  -- 2. Remover ai_feedback
  DELETE FROM ai_feedback WHERE created_by = p_user_id;
  
  -- 3. Remover faq_logs
  DELETE FROM faq_logs WHERE usuario_id = p_user_id;
  
  -- 4. Remover internal_notification_recipients
  DELETE FROM internal_notification_recipients WHERE user_id = p_user_id;
  
  -- 5. Remover internal_notifications criadas pelo usuário
  DELETE FROM internal_notifications WHERE created_by = p_user_id;
  
  -- 6. Remover internal_access_requests
  DELETE FROM internal_access_requests WHERE user_id = p_user_id;
  DELETE FROM internal_access_requests WHERE decided_by = p_user_id;
  
  -- 7. Remover equipe_members
  DELETE FROM equipe_members WHERE user_id = p_user_id;
  
  -- 8. Remover user_permissions
  DELETE FROM user_permissions WHERE user_id = p_user_id;
  
  -- 9. Remover user_roles
  DELETE FROM user_roles WHERE user_id = p_user_id;
  
  -- 10. Atualizar tickets criados pelo usuário (não deletar para manter histórico)
  UPDATE tickets SET criado_por = NULL WHERE criado_por = p_user_id;
  UPDATE tickets SET atendimento_iniciado_por = NULL WHERE atendimento_iniciado_por = p_user_id;
  
  -- 11. Atualizar ticket_mensagens
  UPDATE ticket_mensagens SET usuario_id = NULL WHERE usuario_id = p_user_id;
  
  -- 12. Remover logs onde usuário é responsável (ou atualizar para NULL)
  UPDATE logs_de_sistema SET usuario_responsavel = NULL WHERE usuario_responsavel = p_user_id;
  
  -- 13. Atualizar colaboradores (deslinkar do usuário)
  UPDATE colaboradores SET email = email || '_REMOVED_' || extract(epoch from now())::text 
  WHERE email IN (SELECT email FROM profiles WHERE id = p_user_id);
  
  -- 14. Atualizar franqueados (deslinkar do usuário) 
  UPDATE franqueados SET email = email || '_REMOVED_' || extract(epoch from now())::text
  WHERE email IN (SELECT email FROM profiles WHERE id = p_user_id);
  
  -- 15. Atualizar atendentes (deslinkar do usuário)
  UPDATE atendentes SET user_id = NULL WHERE user_id = p_user_id;
  
  -- 16. Finalmente, remover o profile
  DELETE FROM profiles WHERE id = p_user_id;
  
  -- Log final
  PERFORM log_system_action(
    'acao_humana'::log_tipo,
    'user_management',
    p_user_id::TEXT,
    'Usuário removido completamente do sistema',
    auth.uid(),
    NULL, NULL, NULL, NULL,
    jsonb_build_object('user_id', p_user_id, 'timestamp', now()),
    'web'::log_canal
  );
  
  RAISE NOTICE 'Usuário % removido completamente do sistema', p_user_id;
END;
$$;