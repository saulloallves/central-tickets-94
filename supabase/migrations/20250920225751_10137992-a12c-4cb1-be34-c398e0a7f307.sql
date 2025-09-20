UPDATE message_templates 
SET template_content = '💬 *Resposta do Ticket #{{codigo_ticket}}*

{{texto_resposta}}

📅 *{{timestamp}}*'
WHERE template_key = 'resposta_ticket';