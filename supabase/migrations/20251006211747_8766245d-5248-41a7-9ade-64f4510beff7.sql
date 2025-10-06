-- Add filter columns to notification_source_config
ALTER TABLE notification_source_config
ADD COLUMN filter_column text,
ADD COLUMN filter_value_source text;

COMMENT ON COLUMN notification_source_config.filter_column IS 'Coluna para filtrar na tabela de origem (ex: codigo_grupo)';
COMMENT ON COLUMN notification_source_config.filter_value_source IS 'De onde vem o valor do filtro (ex: unidades.codigo_grupo)';