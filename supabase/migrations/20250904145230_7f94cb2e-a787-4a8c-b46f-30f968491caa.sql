-- Desativar a crise que está causando o alerta falso
UPDATE crises 
SET is_active = false, 
    status = 'resolvido',
    resolved_at = now()
WHERE id = 'aca3393e-77ba-4c77-a398-0818a80517ef' 
AND is_active = true;