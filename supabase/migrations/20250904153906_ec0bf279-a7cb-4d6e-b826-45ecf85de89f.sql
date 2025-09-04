-- Remove os templates desnecessários que criei
DELETE FROM public.message_templates 
WHERE template_key IN (
  'ticket_created_enhanced',
  'resposta_ticket_enhanced', 
  'sla_half_enhanced',
  'sla_breach_enhanced',
  'crisis_enhanced'
);

-- Atualizar os templates existentes com as novas variáveis
UPDATE public.message_templates 
SET 
  template_content = '🎫 *NOVO TICKET CRIADO*

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
  variables = '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "colaborador_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla"]'::jsonb,
  updated_at = now()
WHERE template_key = 'ticket_created';

UPDATE public.message_templates 
SET 
  template_content = '💬 *RESPOSTA DO TICKET*

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
  variables = '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "texto_resposta", "timestamp"]'::jsonb,
  updated_at = now()
WHERE template_key = 'resposta_ticket';

UPDATE public.message_templates 
SET 
  template_content = '⚠️ *ALERTA SLA - 50% DO PRAZO*

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
  variables = '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla"]'::jsonb,
  updated_at = now()
WHERE template_key = 'sla_half';

UPDATE public.message_templates 
SET 
  template_content = '🚨 *SLA VENCIDO*

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
  variables = '["codigo_ticket", "titulo_ticket", "unidade_id", "unidade_nome", "equipe_responsavel", "categoria", "prioridade", "status", "descricao_problema", "data_abertura", "data_limite_sla"]'::jsonb,
  updated_at = now()
WHERE template_key = 'sla_breach';