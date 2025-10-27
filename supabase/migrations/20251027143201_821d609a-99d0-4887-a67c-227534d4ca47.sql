-- Inserir template de notificação de plano de ação
INSERT INTO message_templates (
  template_key,
  template_content,
  description,
  variables,
  is_active
) VALUES (
  'plano_acao_criado',
  '⚙️ Novo Plano de Ação Operacional Registrado!

📋 Código: *{{codigo_plano}}*

📍 Unidade: Cresci e Perdi {{unidade_nome}}

🧩 Área: {{categoria}}

📅 Prazo: {{prazo}}

👤 Responsável local: {{responsavel_local}}

Para visualizar e confirmar o andamento, acesse:
👉 GiraBot.com > Plano de Ação',
  'Notificação enviada via WhatsApp quando um novo plano de ação é criado',
  '["codigo_plano", "unidade_nome", "categoria", "prazo", "responsavel_local"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  template_content = EXCLUDED.template_content,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  updated_at = NOW();