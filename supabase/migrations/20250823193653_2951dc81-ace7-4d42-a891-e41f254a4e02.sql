-- Adicionar todas as permissões necessárias para colaboradores acessarem todas as abas da sidebar
INSERT INTO public.role_permissions (role, permission) VALUES
('colaborador', 'view_all_tickets'),
('colaborador', 'configure_ai_models'),
('colaborador', 'view_audit_logs')
ON CONFLICT (role, permission) DO NOTHING;