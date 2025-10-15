-- Desativar rota de notificação sla_half para WhatsApp
UPDATE public.notification_routes
SET 
  is_active = FALSE,
  updated_at = NOW()
WHERE type = 'sla_half'
  AND id = '57728ece-9b9c-4556-bca9-653ca1345e6d';

-- Desativar template sla_half
UPDATE public.message_templates
SET 
  is_active = FALSE,
  updated_at = NOW()
WHERE template_key = 'sla_half';

-- Registrar mudança de configuração
INSERT INTO logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) VALUES (
  'sistema'::log_tipo,
  'notification_routes',
  '57728ece-9b9c-4556-bca9-653ca1345e6d',
  'Notificações SLA 50% desativadas - não serão mais enviadas para grupos WhatsApp',
  jsonb_build_object('is_active', false, 'tipo', 'sla_half', 'desativado_em', NOW()),
  'web'::log_canal
);