-- Sincronizar id_grupo_branco das unidades da Karol usando unidades_whatsapp
UPDATE atendente_unidades au
SET 
  id_grupo_branco = uw.id_grupo_branco,
  updated_at = now()
FROM unidades_whatsapp uw
WHERE au.codigo_grupo = uw.codigo_grupo
  AND au.atendente_id = 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a'
  AND au.ativo = true
  AND au.id_grupo_branco IS NULL
  AND uw.id_grupo_branco IS NOT NULL;

-- Log da operação
DO $$
DECLARE
  total_sincronizado INTEGER;
  total_faltando INTEGER;
BEGIN
  -- Contar quantas foram sincronizadas (verifica os registros que TÊNIS id_grupo_branco após o UPDATE)
  SELECT COUNT(*) INTO total_sincronizado
  FROM atendente_unidades au
  INNER JOIN unidades_whatsapp uw ON au.codigo_grupo = uw.codigo_grupo
  WHERE au.atendente_id = 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a'
    AND au.ativo = true
    AND au.id_grupo_branco IS NOT NULL
    AND uw.id_grupo_branco IS NOT NULL;
  
  -- Contar quantas ainda estão sem id_grupo_branco
  SELECT COUNT(*) INTO total_faltando
  FROM atendente_unidades
  WHERE atendente_id = 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a'
    AND ativo = true
    AND id_grupo_branco IS NULL;
    
  PERFORM log_system_action(
    'sistema'::log_tipo,
    'atendente_unidades',
    'sync-id-grupo-branco',
    'Sincronização id_grupo_branco: ' || total_sincronizado || ' unidades atualizadas, ' || total_faltando || ' ainda sem id',
    NULL,
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'atendente_id', 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a',
      'atendente_nome', 'Karol Souza',
      'sincronizadas', total_sincronizado,
      'ainda_sem_id', total_faltando
    ),
    'web'::log_canal
  );
END $$;