-- Update message templates with enriched variables
INSERT INTO public.message_templates (template_key, template_content, description, variables, is_active) VALUES
(
  'ticket_created',
  '🎫 *NOVO TICKET CRIADO*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
👤 *Responsável:* {{colaborador_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

💬 *Problema:*
{{descricao_problema}}

🕐 *Aberto em:* {{data_abertura}}
⏰ *Prazo SLA:* {{data_limite_sla}}',
  'Template para notificação de ticket criado',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "colaborador_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla"]'::jsonb,
  true
),
(
  'resposta_ticket',
  '💬 *RESPOSTA DO TICKET*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

📝 *Resposta:*
{{texto_resposta}}

🕐 *Respondido em:* {{timestamp}}',
  'Template para resposta de ticket no grupo',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "texto_resposta", "timestamp"]'::jsonb,
  true
),
(
  'resposta_ticket_franqueado',
  '💬 *RESPOSTA DO SEU TICKET*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}

📝 *Resposta:*
{{texto_resposta}}

🕐 *Respondido em:* {{timestamp}}

Para mais detalhes, acesse o sistema.',
  'Template para resposta enviada ao franqueado',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla", "texto_resposta", "timestamp"]'::jsonb,
  true
),
(
  'sla_half',
  '⚠️ *ALERTA SLA - 50% DO PRAZO*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

💬 *Problema:*
{{descricao_problema}}

🕐 *Aberto em:* {{data_abertura}}
⏰ *Prazo limite:* {{data_limite_sla}}

⚡ Atenção necessária!',
  'Template para alerta de 50% do SLA',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla"]'::jsonb,
  true
),
(
  'sla_breach',
  '🚨 *SLA VENCIDO*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

💬 *Problema:*
{{descricao_problema}}

🕐 *Aberto em:* {{data_abertura}}
⏰ *Venceu em:* {{data_limite_sla}}

🔥 AÇÃO IMEDIATA NECESSÁRIA!',
  'Template para SLA vencido',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla"]'::jsonb,
  true
),
(
  'crisis',
  '🚨 *CRISE DETECTADA*

📋 *Ticket:* {{codigo_ticket}}
📝 *Título:* {{titulo_ticket}}
🏢 *Unidade:* {{unidade_nome}} ({{unidade_id}})
👥 *Equipe:* {{equipe_responsavel}}
📂 *Categoria:* {{categoria}}
⚡ *Prioridade:* {{prioridade}}

💬 *Problema:*
{{descricao_problema}}

🚨 CRISE ATIVADA - ATENÇÃO IMEDIATA!',
  'Template para ativação de crise',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "descricao_problema"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  template_content = EXCLUDED.template_content,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  updated_at = now();