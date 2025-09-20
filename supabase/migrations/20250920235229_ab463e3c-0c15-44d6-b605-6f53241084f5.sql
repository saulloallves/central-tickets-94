UPDATE message_templates 
SET template_content = '💬 *RESPOSTA DO TICKET*

📋 *Título:* {{titulo_ticket}}
👥 *Equipe:* {{equipe_nome}}
⚡ *Prioridade:* {{prioridade}}
📊 *Status:* {{status}}

📝 *Resposta:*
{{texto_resposta}}

📅 *Respondido em:*
{{timestamp}}'
WHERE template_key = 'resposta_ticket';