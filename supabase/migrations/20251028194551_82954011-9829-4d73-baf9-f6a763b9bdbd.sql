-- Remover unidade duplicada 1805 que está causando conflito com unidade 1702

-- 1. Remover de atendente_unidades
DELETE FROM atendente_unidades 
WHERE id = '23fbb9d5-36d1-42a3-959f-3b427717e154'
AND codigo_grupo = '1805';

-- 2. Remover de unidades_whatsapp
DELETE FROM unidades_whatsapp 
WHERE id = 701
AND codigo_grupo = '1805';

-- Log de confirmação
DO $$
BEGIN
  RAISE NOTICE 'Unidade 1805 removida com sucesso. Grupo 120363327731941937-group agora está vinculado apenas à unidade 1702';
END $$;