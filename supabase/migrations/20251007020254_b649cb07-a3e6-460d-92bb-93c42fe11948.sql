-- Executar pausa manual de SLA para tickets abertos (após 18h30)
-- Esta query será executada apenas uma vez para pausar os tickets atuais

UPDATE tickets
SET 
  sla_pausado = true,
  sla_pausado_em = NOW()
WHERE status IN ('aberto', 'em_atendimento')
  AND sla_pausado = false
  AND data_limite_sla IS NOT NULL;

-- Log da ação manual
INSERT INTO logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) 
SELECT 
  'sistema'::log_tipo,
  'tickets_sla',
  id::TEXT,
  'SLA pausado manualmente - Configuração inicial do sistema de pausa automática',
  jsonb_build_object(
    'pausado_em', NOW(),
    'motivo', 'Ativação do sistema de pausa automática às 18h30'
  ),
  'painel_interno'::log_canal
FROM tickets
WHERE status IN ('aberto', 'em_atendimento')
  AND sla_pausado = true
  AND sla_pausado_em >= NOW() - INTERVAL '5 minutes';