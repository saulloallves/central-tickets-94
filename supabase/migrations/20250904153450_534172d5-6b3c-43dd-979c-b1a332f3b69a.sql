-- Create unique index on template_key if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS message_templates_template_key_unique 
ON public.message_templates (template_key);

-- Insert enhanced message templates with new variables
INSERT INTO public.message_templates (template_key, template_content, description, variables, is_active) VALUES
(
  'ticket_created_enhanced',
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
  'Template melhorado para notificação de ticket criado',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "colaborador_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla"]'::jsonb,
  true
),
(
  'resposta_ticket_enhanced',
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
  'Template melhorado para resposta de ticket no grupo',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "texto_resposta", "timestamp"]'::jsonb,
  true
),
(
  'sla_half_enhanced',
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
  'Template melhorado para alerta de 50% do SLA',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla"]'::jsonb,
  true
),
(
  'sla_breach_enhanced',
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
  'Template melhorado para SLA vencido',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla"]'::jsonb,
  true
),
(
  'crisis_enhanced',
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
  'Template melhorado para ativação de crise',
  '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "descricao_problema"]'::jsonb,
  true
);