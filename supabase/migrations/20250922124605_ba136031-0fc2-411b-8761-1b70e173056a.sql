-- Reativar o template resposta_ticket
UPDATE public.message_templates 
SET is_active = true 
WHERE template_key = 'resposta_ticket';