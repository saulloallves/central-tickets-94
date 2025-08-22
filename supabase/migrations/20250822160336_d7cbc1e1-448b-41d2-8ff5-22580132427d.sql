-- Migração para garantir que todas as crises_ativas sejam vinculadas corretamente

-- 1. Para cada crise_ativa sem vinculação, criar uma crise correspondente
WITH unlinked_crises_ativas AS (
  SELECT ca.*
  FROM public.crises_ativas ca
  LEFT JOIN public.crise_ticket_links ctl ON ca.ticket_id = ctl.ticket_id
  WHERE ctl.ticket_id IS NULL
),
new_crises_for_unlinked AS (
  INSERT INTO public.crises (
    titulo, 
    descricao, 
    status, 
    created_at, 
    updated_at, 
    ultima_atualizacao,
    abriu_por
  )
  SELECT 
    COALESCE(uca.motivo, 'Crise: ' || t.codigo_ticket) as titulo,
    'Crise migrada do sistema anterior para ticket ' || t.codigo_ticket as descricao,
    CASE 
      WHEN uca.resolvida_em IS NULL THEN 'aberto'::public.crise_status
      ELSE 'encerrado'::public.crise_status
    END as status,
    uca.criada_em as created_at,
    COALESCE(uca.resolvida_em, NOW()) as updated_at,
    COALESCE(uca.resolvida_em, NOW()) as ultima_atualizacao,
    uca.criada_por as abriu_por
  FROM unlinked_crises_ativas uca
  JOIN public.tickets t ON t.id = uca.ticket_id
  RETURNING id, titulo, created_at, abriu_por
)
-- 2. Vincular os tickets das crises_ativas às novas crises criadas
INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
SELECT 
  c.id as crise_id,
  ca.ticket_id,
  ca.criada_por as linked_by
FROM public.crises_ativas ca
JOIN public.crises c ON (
  c.titulo LIKE '%' || SPLIT_PART(t.codigo_ticket, '-', 1) || '%'
  AND c.abriu_por = ca.criada_por
  AND c.created_at::date = ca.criada_em::date
)
JOIN public.tickets t ON t.id = ca.ticket_id
LEFT JOIN public.crise_ticket_links existing_ctl ON existing_ctl.ticket_id = ca.ticket_id
WHERE existing_ctl.ticket_id IS NULL;

-- 3. Adicionar updates às crises migradas
INSERT INTO public.crise_updates (crise_id, tipo, status, mensagem, created_by, created_at)
SELECT 
  ctl.crise_id,
  'info' as tipo,
  c.status,
  'Crise migrada automaticamente do sistema anterior' as mensagem,
  c.abriu_por as created_by,
  c.created_at
FROM public.crise_ticket_links ctl
JOIN public.crises c ON c.id = ctl.crise_id
JOIN public.crises_ativas ca ON ca.ticket_id = ctl.ticket_id
WHERE c.titulo LIKE '%migrada%' OR c.titulo LIKE '%Crise:%'
ON CONFLICT DO NOTHING;