-- Adicionar configuração de rota para mensagem_customizada
INSERT INTO notification_source_config (
  notification_type,
  source_type,
  source_table,
  source_column,
  filter_column,
  filter_value_source,
  description,
  is_active
) VALUES (
  'mensagem_customizada',
  'column',
  'unidades_whatsapp',
  'id_grupo_branco',
  'codigo_grupo',
  'unidades.codigo_grupo',
  'Mensagem customizada - envia para grupo WhatsApp da unidade',
  true
)
ON CONFLICT (notification_type) 
DO UPDATE SET
  source_type = EXCLUDED.source_type,
  source_table = EXCLUDED.source_table,
  source_column = EXCLUDED.source_column,
  filter_column = EXCLUDED.filter_column,
  filter_value_source = EXCLUDED.filter_value_source,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();