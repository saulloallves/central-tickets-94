-- Corrigir crises existentes para ter o equipe_id correto
UPDATE public.crises 
SET equipe_id = '8d89dc60-7aad-4fdd-a574-9895ce0080eb'
WHERE is_active = true AND equipe_id IS NULL;

-- Vincular os tickets similares às crises existentes
INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
SELECT 
  c.id as crise_id,
  t.id as ticket_id,
  NULL as linked_by  -- Sistema automático
FROM public.crises c
CROSS JOIN public.tickets t
WHERE c.is_active = true
  AND c.equipe_id = '8d89dc60-7aad-4fdd-a574-9895ce0080eb'
  AND t.equipe_responsavel_id = '8d89dc60-7aad-4fdd-a574-9895ce0080eb'
  AND t.descricao_problema ILIKE '%sistyema caiu%'
  AND t.data_abertura >= NOW() - INTERVAL '1 hour'
  AND NOT EXISTS (
    SELECT 1 FROM public.crise_ticket_links ctl 
    WHERE ctl.ticket_id = t.id
  )
ON CONFLICT (crise_id, ticket_id) DO NOTHING;