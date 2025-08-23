-- Remover permissões de Governança, Configurações e Permissões para colaboradores
DELETE FROM public.role_permissions 
WHERE role = 'colaborador' 
AND permission IN ('configure_ai_models', 'view_audit_logs');