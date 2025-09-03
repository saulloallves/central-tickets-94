-- Atualizar configuração para crisis_update com destino padrão
UPDATE notification_source_config 
SET 
  source_type = 'column',
  source_table = 'unidades',
  source_column = 'id_grupo_branco',
  description = 'Atualização de crise - envia para grupo da unidade (id_grupo_branco)'
WHERE notification_type = 'crisis_update';

-- Atualizar configuração para crisis com destino padrão
UPDATE notification_source_config 
SET 
  source_type = 'column',
  source_table = 'unidades', 
  source_column = 'id_grupo_branco',
  description = 'Notificação de crise - envia para grupo da unidade (id_grupo_branco)'
WHERE notification_type = 'crisis';

-- Atualizar configuração para crisis_resolved com destino padrão
UPDATE notification_source_config 
SET 
  source_type = 'column',
  source_table = 'unidades',
  source_column = 'id_grupo_branco', 
  description = 'Crise resolvida - envia para grupo da unidade (id_grupo_branco)'
WHERE notification_type = 'crisis_resolved';