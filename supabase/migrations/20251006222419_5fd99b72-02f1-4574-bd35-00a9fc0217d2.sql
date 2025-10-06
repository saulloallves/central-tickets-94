-- FASE 1.1: Popular atendente_id em atendente_unidades
-- Linkando atendentes por telefone (chave primária) e nome como fallback

-- Passo 1: Limpar telefones para matching (normalizar formato)
UPDATE atendente_unidades
SET concierge_phone = regexp_replace(concierge_phone, '[^0-9]', '', 'g')
WHERE concierge_phone IS NOT NULL
  AND concierge_phone ~ '[^0-9]';

UPDATE atendentes
SET telefone = regexp_replace(telefone, '[^0-9]', '', 'g')
WHERE telefone IS NOT NULL
  AND telefone ~ '[^0-9]';

-- Passo 2: Popular atendente_id por telefone (match exato)
UPDATE atendente_unidades au
SET atendente_id = a.id::text
FROM atendentes a
WHERE au.concierge_phone IS NOT NULL
  AND a.telefone IS NOT NULL
  AND regexp_replace(au.concierge_phone, '[^0-9]', '', 'g') = regexp_replace(a.telefone, '[^0-9]', '', 'g')
  AND au.atendente_id IS NULL;

-- Passo 3: Popular atendente_id por nome (fallback para casos sem telefone)
UPDATE atendente_unidades au
SET atendente_id = a.id::text
FROM atendentes a
WHERE au.concierge_name IS NOT NULL
  AND a.nome IS NOT NULL
  AND LOWER(TRIM(au.concierge_name)) = LOWER(TRIM(a.nome))
  AND au.atendente_id IS NULL;

-- Passo 4: Popular atendente_id por nome parcial (segunda tentativa)
UPDATE atendente_unidades au
SET atendente_id = a.id::text
FROM atendentes a
WHERE au.concierge_name IS NOT NULL
  AND a.nome IS NOT NULL
  AND (
    LOWER(TRIM(au.concierge_name)) LIKE '%' || LOWER(TRIM(a.nome)) || '%'
    OR LOWER(TRIM(a.nome)) LIKE '%' || LOWER(TRIM(au.concierge_name)) || '%'
  )
  AND au.atendente_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM atendentes a2
    WHERE LOWER(TRIM(au.concierge_name)) = LOWER(TRIM(a2.nome))
  );

-- VALIDAÇÃO: Criar view temporária para análise
CREATE OR REPLACE VIEW atendente_unidades_validation AS
SELECT 
  au.id,
  au.concierge_name,
  au.concierge_phone,
  au.codigo_grupo,
  au.atendente_id,
  a.nome as atendente_nome,
  a.telefone as atendente_telefone,
  a.tipo as atendente_tipo,
  a.status as atendente_status,
  CASE 
    WHEN au.atendente_id IS NULL THEN '❌ SEM ATENDENTE'
    WHEN a.id IS NULL THEN '⚠️ ATENDENTE INEXISTENTE'
    WHEN a.ativo = false THEN '⚠️ ATENDENTE INATIVO'
    ELSE '✅ OK'
  END as status_validacao
FROM atendente_unidades au
LEFT JOIN atendentes a ON a.id::text = au.atendente_id
WHERE au.ativo = true
ORDER BY status_validacao DESC, au.codigo_grupo;

-- Log da execução
DO $$
DECLARE
  total_records INTEGER;
  populated_records INTEGER;
  missing_records INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_records FROM atendente_unidades WHERE ativo = true;
  SELECT COUNT(*) INTO populated_records FROM atendente_unidades WHERE ativo = true AND atendente_id IS NOT NULL;
  SELECT COUNT(*) INTO missing_records FROM atendente_unidades WHERE ativo = true AND atendente_id IS NULL;
  
  RAISE NOTICE '=== FASE 1.1: POPULAÇÃO DE ATENDENTE_ID ===';
  RAISE NOTICE 'Total de registros ativos: %', total_records;
  RAISE NOTICE 'Registros com atendente_id populado: % (%.1f%%)', populated_records, (populated_records::numeric / NULLIF(total_records, 0) * 100);
  RAISE NOTICE 'Registros sem atendente_id: % (%.1f%%)', missing_records, (missing_records::numeric / NULLIF(total_records, 0) * 100);
  RAISE NOTICE '';
  RAISE NOTICE 'Execute para validar:';
  RAISE NOTICE 'SELECT * FROM atendente_unidades_validation;';
END $$;