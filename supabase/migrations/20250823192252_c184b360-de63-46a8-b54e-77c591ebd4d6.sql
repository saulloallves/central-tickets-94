-- Adicionar permissões básicas para colaboradores
INSERT INTO role_permissions (role, permission) VALUES 
('colaborador', 'access_dashboards'),
('colaborador', 'view_own_unit_tickets'),
('colaborador', 'respond_tickets'),
('colaborador', 'view_team_tickets');