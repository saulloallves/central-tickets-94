-- Sincronizar id_grupo_branco na tabela unidades usando unidades_whatsapp
UPDATE unidades u
SET 
  id_grupo_branco = uw.id_grupo_branco,
  updated_at = now()
FROM unidades_whatsapp uw
WHERE u.codigo_grupo = uw.codigo_grupo
  AND u.id_grupo_branco IS NULL
  AND uw.id_grupo_branco IS NOT NULL;

-- Log da operação
DO $$
DECLARE
  total_sincronizado INTEGER;
  total_ainda_sem_id INTEGER;
BEGIN
  -- Contar quantas foram sincronizadas
  SELECT COUNT(*) INTO total_sincronizado
  FROM unidades u
  INNER JOIN unidades_whatsapp uw ON u.codigo_grupo = uw.codigo_grupo
  WHERE u.id_grupo_branco IS NOT NULL
    AND uw.id_grupo_branco IS NOT NULL;
  
  -- Contar quantas ainda estão sem id_grupo_branco
  SELECT COUNT(*) INTO total_ainda_sem_id
  FROM unidades
  WHERE id_grupo_branco IS NULL;
    
  PERFORM log_system_action(
    'sistema'::log_tipo,
    'unidades',
    'sync-id-grupo-branco',
    'Sincronização id_grupo_branco em unidades: ' || total_sincronizado || ' atualizadas, ' || total_ainda_sem_id || ' ainda sem id',
    NULL,
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'tabela', 'unidades',
      'sincronizadas', total_sincronizado,
      'ainda_sem_id', total_ainda_sem_id,
      'fonte', 'unidades_whatsapp'
    ),
    'web'::log_canal
  );
END $$;