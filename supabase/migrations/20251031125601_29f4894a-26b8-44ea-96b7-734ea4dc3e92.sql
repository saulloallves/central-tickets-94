-- ==================================================
-- SINCRONIZAÇÃO DE ATENDENTE_UNIDADES
-- Fase 1: Corrigir IDs divergentes (3 grupos)
-- Fase 2: Cadastrar grupos faltantes (102 grupos)
-- ==================================================

-- FASE 1: Atualizar id_grupo_branco dos grupos com divergência
UPDATE atendente_unidades au
SET 
  id_grupo_branco = uw.id_grupo_branco,
  updated_at = NOW()
FROM unidades_whatsapp uw
WHERE au.codigo_grupo = uw.codigo_grupo
  AND au.id_grupo_branco IS DISTINCT FROM uw.id_grupo_branco
  AND au.ativo = true;

-- FASE 2: Inserir grupos faltantes vinculados à Karol Souza
INSERT INTO atendente_unidades (
  atendente_id,
  codigo_grupo,
  grupo,
  id_grupo_branco,
  concierge_name,
  concierge_phone,
  prioridade,
  ativo
)
SELECT 
  'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a', -- Karol Souza
  uw.codigo_grupo,
  uw.grupo,
  uw.id_grupo_branco,
  'Karol Souza',
  '5511945556224',
  1,
  true
FROM unidades_whatsapp uw
LEFT JOIN atendente_unidades au ON uw.codigo_grupo = au.codigo_grupo AND au.ativo = true
WHERE au.id IS NULL
  AND uw.id_grupo_branco IS NOT NULL;

-- Log da operação
INSERT INTO system_logs (level, message, metadata)
VALUES (
  'info',
  'Sincronização completa de atendente_unidades realizada',
  jsonb_build_object(
    'grupos_corrigidos', 3,
    'grupos_inseridos', 102,
    'atendente', 'Karol Souza',
    'executado_em', NOW()
  )
);