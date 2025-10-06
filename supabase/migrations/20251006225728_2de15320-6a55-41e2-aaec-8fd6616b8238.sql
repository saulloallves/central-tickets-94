-- Atualizar todos os registros de Maria Débora para Karol
UPDATE atendente_unidades
SET concierge_name = 'Karol'
WHERE concierge_name = 'Maria Débora';

-- Log da alteração
SELECT COUNT(*) as registros_atualizados
FROM atendente_unidades
WHERE concierge_name = 'Karol';