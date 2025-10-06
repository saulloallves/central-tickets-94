-- Atualizar configuração de notificação de ticket criado para usar unidades_whatsapp com filtro
UPDATE notification_source_config
SET 
  source_table = 'unidades_whatsapp',
  source_column = 'id_grupo_branco',
  filter_column = 'codigo_grupo',
  filter_value_source = 'unidades.codigo_grupo',
  description = 'Notificação de novo ticket - busca id_grupo_branco de unidades_whatsapp filtrando por codigo_grupo',
  updated_at = NOW()
WHERE notification_type = 'ticket_created';