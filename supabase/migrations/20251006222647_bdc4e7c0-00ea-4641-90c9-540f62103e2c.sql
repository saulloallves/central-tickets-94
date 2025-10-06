-- FASE 1.2 (CORRIGIDA): Converter atendente_id de text para UUID e adicionar FKs
-- Dropar view primeiro para evitar conflitos

-- Passo 0: Dropar view temporária
DROP VIEW IF EXISTS atendente_unidades_validation;

-- Passo 1: Converter atendente_unidades.atendente_id de text para UUID
ALTER TABLE atendente_unidades
  ALTER COLUMN atendente_id TYPE uuid USING atendente_id::uuid;

-- Passo 2: Adicionar FK em atendente_unidades para atendentes
ALTER TABLE atendente_unidades
  ADD CONSTRAINT fk_atendente_unidades_atendente
  FOREIGN KEY (atendente_id)
  REFERENCES atendentes(id)
  ON DELETE SET NULL;

-- Passo 3: Converter chamados.atendente_id de text para UUID
-- Primeiro, criar uma coluna temporária
ALTER TABLE chamados
  ADD COLUMN atendente_id_uuid uuid;

-- Copiar dados convertidos para a nova coluna (apenas UUIDs válidos)
UPDATE chamados
SET atendente_id_uuid = atendente_id::uuid
WHERE atendente_id IS NOT NULL
  AND atendente_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Dropar coluna antiga
ALTER TABLE chamados DROP COLUMN atendente_id;

-- Renomear nova coluna
ALTER TABLE chamados RENAME COLUMN atendente_id_uuid TO atendente_id;

-- Passo 4: Adicionar FK em chamados para atendentes
ALTER TABLE chamados
  ADD CONSTRAINT fk_chamados_atendente
  FOREIGN KEY (atendente_id)
  REFERENCES atendentes(id)
  ON DELETE SET NULL;

-- Passo 5: Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_atendente_unidades_atendente_id 
  ON atendente_unidades(atendente_id) 
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_chamados_atendente_id 
  ON chamados(atendente_id);

-- Passo 6: Recriar view de validação com novo tipo UUID
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
  a.capacidade_atual,
  a.capacidade_maxima,
  CASE 
    WHEN au.atendente_id IS NULL THEN '❌ SEM ATENDENTE'
    WHEN a.id IS NULL THEN '⚠️ FK QUEBRADO'
    WHEN a.ativo = false THEN '⚠️ ATENDENTE INATIVO'
    WHEN a.status != 'ativo' THEN '⚠️ STATUS: ' || a.status
    ELSE '✅ OK'
  END as status_validacao,
  -- Contar chamados associados
  (SELECT COUNT(*) FROM chamados c WHERE c.atendente_id = a.id) as total_chamados
FROM atendente_unidades au
LEFT JOIN atendentes a ON a.id = au.atendente_id
WHERE au.ativo = true
ORDER BY status_validacao DESC, au.codigo_grupo;

-- VALIDAÇÃO FINAL
DO $$
DECLARE
  total_au INTEGER;
  au_com_atendente INTEGER;
  au_sem_atendente INTEGER;
  fk_validas INTEGER;
  total_chamados INTEGER;
  chamados_com_atendente INTEGER;
BEGIN
  -- Estatísticas atendente_unidades
  SELECT COUNT(*) INTO total_au FROM atendente_unidades WHERE ativo = true;
  SELECT COUNT(*) INTO au_com_atendente FROM atendente_unidades WHERE ativo = true AND atendente_id IS NOT NULL;
  SELECT COUNT(*) INTO au_sem_atendente FROM atendente_unidades WHERE ativo = true AND atendente_id IS NULL;
  
  -- Verificar FKs válidas
  SELECT COUNT(*) INTO fk_validas 
  FROM atendente_unidades au
  INNER JOIN atendentes a ON a.id = au.atendente_id
  WHERE au.ativo = true;
  
  -- Estatísticas chamados
  SELECT COUNT(*) INTO total_chamados FROM chamados;
  SELECT COUNT(*) INTO chamados_com_atendente FROM chamados WHERE atendente_id IS NOT NULL;
  
  RAISE NOTICE '=== FASE 1.2: CONVERSÃO PARA UUID E FKs ===';
  RAISE NOTICE '';
  RAISE NOTICE '📊 ATENDENTE_UNIDADES:';
  RAISE NOTICE '   Total de registros ativos: %', total_au;
  RAISE NOTICE '   Com atendente_id: % (%.1f%%)', au_com_atendente, (au_com_atendente::numeric / NULLIF(total_au, 0) * 100);
  RAISE NOTICE '   Sem atendente_id: % (%.1f%%)', au_sem_atendente, (au_sem_atendente::numeric / NULLIF(total_au, 0) * 100);
  RAISE NOTICE '   FKs válidas: % (%.1f%%)', fk_validas, (fk_validas::numeric / NULLIF(au_com_atendente, 0) * 100);
  RAISE NOTICE '';
  RAISE NOTICE '📊 CHAMADOS:';
  RAISE NOTICE '   Total de chamados: %', total_chamados;
  RAISE NOTICE '   Com atendente: % (%.1f%%)', chamados_com_atendente, (chamados_com_atendente::numeric / NULLIF(total_chamados, 0) * 100);
  RAISE NOTICE '';
  RAISE NOTICE '✅ Conversão concluída!';
  RAISE NOTICE '   - atendente_unidades.atendente_id: text → UUID';
  RAISE NOTICE '   - chamados.atendente_id: text → UUID';
  RAISE NOTICE '   - Foreign keys adicionadas';
  RAISE NOTICE '   - Índices criados para performance';
  RAISE NOTICE '';
  RAISE NOTICE 'Execute para validar:';
  RAISE NOTICE 'SELECT * FROM atendente_unidades_validation;';
END $$;