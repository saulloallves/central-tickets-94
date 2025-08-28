-- First, let's see what roles exist that are causing issues
DO $$
DECLARE
    invalid_roles TEXT[];
BEGIN
    -- Get all roles that aren't in the enum
    SELECT ARRAY_AGG(DISTINCT ur.role::TEXT) INTO invalid_roles
    FROM user_roles ur
    WHERE ur.role::TEXT NOT IN ('admin', 'colaborador', 'supervisor', 'franqueado');
    
    IF array_length(invalid_roles, 1) > 0 THEN
        RAISE NOTICE 'Found invalid roles: %', invalid_roles;
    END IF;
END $$;

-- Add missing role to enum if needed
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'gerente';

-- Check if there are any other problematic role values
UPDATE user_roles 
SET role = 'supervisor'::app_role 
WHERE role::TEXT = 'gerente' AND role::TEXT NOT IN (SELECT unnest(enum_range(NULL::app_role))::TEXT);

-- Also check role_permissions table for consistency
INSERT INTO role_permissions (role, permission)
SELECT 'gerente'::app_role, permission
FROM role_permissions 
WHERE role = 'supervisor'::app_role
ON CONFLICT (role, permission) DO NOTHING;