-- Corrigir inconsistência: atualizar codigo_grupo de '1659' para '566'
-- para manter consistência com os chamados existentes
UPDATE atendente_unidades 
SET codigo_grupo = '566'
WHERE codigo_grupo = '1659';