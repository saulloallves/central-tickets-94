-- Add permissions for gerente role
INSERT INTO role_permissions (role, permission)
SELECT 'gerente'::app_role, permission
FROM role_permissions 
WHERE role = 'supervisor'::app_role
ON CONFLICT (role, permission) DO NOTHING;