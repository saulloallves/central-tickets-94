-- Atualizar template de mensagem_customizada para usar resposta_real
UPDATE message_templates
SET template_content = '📝 *Mensagem da equipe:*

{{resposta_real}}

---
🔢 *Ticket:* {{codigo_ticket}}
📅 {{timestamp}}'
WHERE template_key = 'mensagem_customizada';