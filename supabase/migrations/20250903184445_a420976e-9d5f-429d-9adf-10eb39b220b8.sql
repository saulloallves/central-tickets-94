-- Update the crisis template to match the ticket response format
UPDATE message_templates 
SET template_content = '🚨 *CRISE ATIVA* 🚨

🎫 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}

💥 *Motivo:*
{{motivo}}

⏰ *Informado em:* {{timestamp}}

_Mensagem enviada automaticamente pelo sistema de gerenciamento de crises_',
    variables = '["codigo_ticket", "unidade_id", "motivo", "timestamp"]',
    description = 'Template para ativação de crise - formato similar ao resposta_ticket'
WHERE template_key = 'crisis';

-- If crisis template doesn't exist, create it
INSERT INTO message_templates (template_key, template_content, description, variables, is_active)
SELECT 'crisis', 
       '🚨 *CRISE ATIVA* 🚨

🎫 *Ticket:* {{codigo_ticket}}
🏢 *Unidade:* {{unidade_id}}

💥 *Motivo:*
{{motivo}}

⏰ *Informado em:* {{timestamp}}

_Mensagem enviada automaticamente pelo sistema de gerenciamento de crises_',
       'Template para ativação de crise - formato similar ao resposta_ticket',
       '["codigo_ticket", "unidade_id", "motivo", "timestamp"]',
       true
WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE template_key = 'crisis');