-- Inserir templates de acompanhamento (JSONB format)
INSERT INTO message_templates (template_key, template_content, description, variables, is_active, created_at)
VALUES 
(
  'acompanhamento_iniciado',
  '👁️ Sua unidade entrou em Acompanhamento!

📍 Unidade: {{unidade_nome}}
📅 Data de início: {{data_inicio}}

Nossa equipe de Consultoria de Campo está acompanhando a operação da sua unidade.

Em breve, entraremos em contato para agendar uma reunião inicial.

👉 GiraBot.com > Plano de Ação',
  'Notificação enviada quando uma unidade entra em acompanhamento',
  '["unidade_nome", "data_inicio"]'::jsonb,
  true,
  NOW()
),
(
  'reuniao_agendada',
  '📅 Reunião de Acompanhamento Agendada!

📍 Unidade: {{unidade_nome}}

👤 Consultor(a): {{responsavel_nome}}
🗓️ Data/Hora: {{data_reuniao}}

{{link_zoom_texto}}

Por favor, confirme sua presença respondendo esta mensagem.

✅ Para confirmar, responda: *CONFIRMAR REUNIÃO*

👉 GiraBot.com > Plano de Ação',
  'Notificação enviada quando uma reunião é agendada',
  '["unidade_nome", "responsavel_nome", "data_reuniao", "link_zoom_texto"]'::jsonb,
  true,
  NOW()
),
(
  'reuniao_confirmada',
  '✅ Reunião Confirmada!

📍 Unidade: {{unidade_nome}}

👤 Consultor(a): {{responsavel_nome}}
🗓️ Data/Hora: {{data_reuniao}}

Sua presença foi confirmada! Nos vemos em breve.

👉 GiraBot.com > Plano de Ação',
  'Notificação enviada quando a presença na reunião é confirmada',
  '["unidade_nome", "responsavel_nome", "data_reuniao"]'::jsonb,
  true,
  NOW()
),
(
  'acompanhamento_finalizado',
  '🎯 Acompanhamento Finalizado!

📍 Unidade: {{unidade_nome}}
📅 Finalizado em: {{data_finalizacao}}
⏱️ Duração: {{duracao_dias}} dias

{{plano_acao_texto}}

Parabéns pelo comprometimento! Continue acompanhando a evolução através do sistema.

👉 GiraBot.com > Plano de Ação',
  'Notificação enviada quando o acompanhamento é finalizado',
  '["unidade_nome", "data_finalizacao", "duracao_dias", "plano_acao_texto"]'::jsonb,
  true,
  NOW()
)
ON CONFLICT (template_key) DO UPDATE SET
  template_content = EXCLUDED.template_content,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  updated_at = NOW();