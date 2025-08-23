-- Adicionar permissão access_dashboards para colaboradores
INSERT INTO role_permissions (role, permission) 
VALUES ('colaborador', 'access_dashboards');