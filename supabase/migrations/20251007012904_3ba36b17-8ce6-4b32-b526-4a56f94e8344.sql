-- Corrigir template resposta_ticket para usar equipe_responsavel em vez de equipe_nome
UPDATE public.message_templates 
SET template_content = '🔔 Chegou uma nova resposta no seu ticket!

📋 Título: {{titulo_ticket}}
👥 Equipe: {{equipe_responsavel}}
⚡ Prioridade: {{prioridade}}
📊 Status: {{status}}
📅 Atualizado em: {{timestamp}}

👉 Para visualizar e responder, acesse o Girabot → Tickets → Consultar Abertos.'
WHERE template_key = 'resposta_ticket';