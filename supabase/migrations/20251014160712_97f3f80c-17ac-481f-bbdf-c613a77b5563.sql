-- Remoção seletiva: Remover vínculos do Gabriel e vincular apenas unidades órfãs à Karol

-- 1. Remover TODOS os vínculos do Gabriel (385 vínculos)
DELETE FROM atendente_unidades
WHERE atendente_id = '4961cb08-7db7-4a55-8c04-a20502bf2a25';

-- 2. Vincular APENAS unidades órfãs (sem nenhum concierge ativo) à Karol
INSERT INTO atendente_unidades (
  atendente_id,
  codigo_grupo,
  grupo,
  concierge_name,
  concierge_phone,
  ativo
)
SELECT 
  'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a' as atendente_id, -- Karol
  u.codigo_grupo,
  u.grupo,
  'Karol Souza' as concierge_name,
  '5511971658008' as concierge_phone,
  true as ativo
FROM unidades u
WHERE NOT EXISTS (
  -- Verificar se NÃO existe nenhum atendente concierge ativo para esta unidade
  SELECT 1 
  FROM atendente_unidades au
  JOIN atendentes a ON au.atendente_id = a.id
  WHERE au.codigo_grupo = u.codigo_grupo
    AND au.ativo = true
    AND a.tipo = 'concierge'
    AND a.ativo = true
)
ON CONFLICT DO NOTHING;

-- 3. Log da operação
DO $$
DECLARE
  total_karol INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_karol
  FROM atendente_unidades
  WHERE atendente_id = 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a'
    AND ativo = true;
    
  PERFORM log_system_action(
    'sistema'::log_tipo,
    'atendente_unidades',
    'bulk-transfer',
    'Remoção seletiva: 385 vínculos removidos de Gabriel, unidades órfãs vinculadas à Karol. Total atual Karol: ' || total_karol,
    NULL,
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'gabriel_removed', 385,
      'karol_total', total_karol
    ),
    'web'::log_canal
  );
END $$;