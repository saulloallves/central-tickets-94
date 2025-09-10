-- Aprovar roles existentes de admin e diretoria que estão como false
UPDATE user_roles 
SET approved = true 
WHERE role IN ('admin', 'diretoria', 'supervisor') 
AND approved = false;

-- Verificar se há outras roles que precisam ser aprovadas
SELECT ur.user_id, p.nome_completo, p.email, ur.role, ur.approved
FROM user_roles ur
LEFT JOIN profiles p ON p.id = ur.user_id
WHERE ur.role IN ('admin', 'diretoria', 'supervisor')
ORDER BY ur.created_at;