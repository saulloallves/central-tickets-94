-- Adicionar permissões que faltam para colaboradores
INSERT INTO role_permissions (role, permission) VALUES 
('colaborador', 'respond_tickets'),
('colaborador', 'view_team_tickets')
ON CONFLICT (role, permission) DO NOTHING;