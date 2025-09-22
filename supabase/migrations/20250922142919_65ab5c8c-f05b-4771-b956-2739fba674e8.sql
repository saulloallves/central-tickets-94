-- Criar configuração de origem para notificação da equipe quando franqueado responde
INSERT INTO public.notification_source_config (
    notification_type,
    source_type,
    source_table,
    source_column,
    description,
    is_active
) VALUES (
    'franqueado_respondeu_ticket',
    'column',
    'messaging_providers',
    'phone',
    'Notificação para equipe quando franqueado responde ticket',
    true
) ON CONFLICT (notification_type) DO NOTHING;

-- Criar rota de notificação para a equipe
INSERT INTO public.notification_routes (
    type,
    destination_value,
    is_active,
    priority,
    description
) VALUES (
    'franqueado_respondeu_ticket',
    'equipe_responsavel',
    true,
    1,
    'Notificação para equipe responsável quando franqueado responde'
) ON CONFLICT (type, destination_value) DO NOTHING;

-- Criar template para notificação da equipe sobre resposta do franqueado
INSERT INTO public.message_templates (
    template_key,
    scope,
    template_content,
    description,
    variables,
    is_active
) VALUES (
    'franqueado_respondeu_ticket',
    'global',
    '🔔 FRANQUEADO RESPONDEU!

📋 Ticket: {{codigo_ticket}}
👤 Franqueado: {{franqueado_nome}}
📱 Via: Typebot

💬 Resposta:
{{texto_resposta}}

🕐 Respondido em: {{timestamp}}

👉 Acesse o sistema para visualizar',
    'Template para notificar equipe quando franqueado responde via Typebot',
    '["codigo_ticket", "franqueado_nome", "texto_resposta", "timestamp", "unidade_id"]',
    true
) ON CONFLICT (template_key) DO NOTHING;