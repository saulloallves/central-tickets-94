-- FASE 1: Corrigir incompatibilidade de tipos
-- Converter unidades_whatsapp.codigo_grupo de bigint para text
ALTER TABLE unidades_whatsapp 
  ALTER COLUMN codigo_grupo TYPE text USING codigo_grupo::text;

-- FASE 2: Atualizar notification_source_config para usar unidades_whatsapp
UPDATE notification_source_config
SET
  source_table = 'unidades_whatsapp',
  source_column = 'id_grupo_branco',
  filter_column = 'codigo_grupo',
  filter_value_source = 'unidades.codigo_grupo'
WHERE notification_type IN ('crisis_resolved', 'crisis_update', 'franqueado_respondeu_ticket')
  AND source_table = 'unidades';

-- FASE 5: Popular unidades.id_grupo_branco com valores de unidades_whatsapp como backup
UPDATE unidades u
SET id_grupo_branco = uw.id_grupo_branco
FROM unidades_whatsapp uw
WHERE u.codigo_grupo = uw.codigo_grupo
  AND u.id_grupo_branco IS DISTINCT FROM uw.id_grupo_branco;