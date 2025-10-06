-- Corrigir configuração de notificação para resposta_ticket
-- Apontar para a tabela unidades_whatsapp correta com filtro por codigo_grupo

UPDATE notification_source_config
SET
  source_table = 'unidades_whatsapp',
  source_column = 'id_grupo_branco',
  filter_column = 'codigo_grupo',
  filter_value_source = 'unidades.codigo_grupo',
  description = 'Resposta de ticket - busca id_grupo_branco de unidades_whatsapp filtrando por codigo_grupo',
  updated_at = NOW()
WHERE notification_type = 'resposta_ticket';

-- Log da correção
INSERT INTO logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) VALUES (
  'sistema'::log_tipo,
  'notification_source_config',
  'resposta_ticket',
  'Correção de configuração - apontar para unidades_whatsapp',
  jsonb_build_object(
    'source_table', 'unidades_whatsapp',
    'filter_column', 'codigo_grupo',
    'filter_value_source', 'unidades.codigo_grupo'
  ),
  'web'::log_canal
);