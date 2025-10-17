-- Corrigir configuração de rota para mensagem_customizada
-- O problema é que filter_value_source aponta para unidades.codigo_grupo
-- mas o ticket já tem codigo_grupo diretamente
UPDATE notification_source_config
SET filter_value_source = 'codigo_grupo',
    description = 'Mensagem customizada - envia para grupo WhatsApp da unidade (filtro por codigo_grupo direto)'
WHERE notification_type = 'mensagem_customizada';