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
    'unidades',
    'id_grupo_branco',
    'Notificação para equipe quando franqueado responde ticket',
    true
) ON CONFLICT (notification_type) DO NOTHING;

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