-- Corrigir atendente_id NULL na tabela atendente_unidades
-- Vincular unidades aos atendentes corretos baseado no nome do concierge

-- 1. Atualizar unidades com concierge_name para o atendente correspondente
UPDATE atendente_unidades au
SET atendente_id = a.id
FROM atendentes a
WHERE au.atendente_id IS NULL
  AND au.concierge_name IS NOT NULL
  AND a.nome = au.concierge_name
  AND a.tipo = 'concierge'
  AND a.ativo = true;

-- 2. Para unidades sem match por nome, atribuir qualquer atendente concierge ativo
UPDATE atendente_unidades au
SET atendente_id = (
  SELECT a.id 
  FROM atendentes a 
  WHERE a.tipo = 'concierge' 
    AND a.ativo = true 
    AND a.status = 'ativo'
  LIMIT 1
)
WHERE au.atendente_id IS NULL
  AND au.concierge_name IS NOT NULL;

-- 3. Log das correções realizadas
DO $$
DECLARE
  corrected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO corrected_count
  FROM atendente_unidades
  WHERE atendente_id IS NOT NULL;
  
  RAISE NOTICE 'Total de unidades com atendente_id preenchido: %', corrected_count;
END $$;

-- 4. Criar índice para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_atendente_unidades_atendente_id 
ON atendente_unidades(atendente_id) 
WHERE ativo = true;

-- 5. Criar índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_atendente_unidades_lookup 
ON atendente_unidades(id, atendente_id, ativo);
