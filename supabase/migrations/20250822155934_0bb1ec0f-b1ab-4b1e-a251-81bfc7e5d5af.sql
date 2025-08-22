-- Migração para consolidar sistema de crises
-- Vamos migrar dados de crises_ativas para o sistema moderno de crises

-- 1. Primeiro, migrar crises_ativas existentes para crises
INSERT INTO public.crises (titulo, descricao, status, created_at, updated_at, abriu_por)
SELECT 
  COALESCE(motivo, 'Crise migrada de sistema antigo') as titulo,
  'Crise migrada automaticamente do sistema anterior' as descricao,
  CASE 
    WHEN resolvida_em IS NULL THEN 'aberto'::public.crise_status
    ELSE 'encerrado'::public.crise_status
  END as status,
  criada_em as created_at,
  COALESCE(resolvida_em, criada_em) as updated_at,
  criada_por as abriu_por
FROM public.crises_ativas
WHERE NOT EXISTS (
  SELECT 1 FROM public.crises c 
  WHERE c.titulo = COALESCE(crises_ativas.motivo, 'Crise migrada de sistema antigo')
  AND c.created_at::date = crises_ativas.criada_em::date
);

-- 2. Migrar vinculações de tickets das crises ativas
WITH migrated_crises AS (
  SELECT 
    c.id as crise_id,
    ca.ticket_id,
    ca.criada_por,
    ca.criada_em
  FROM public.crises_ativas ca
  JOIN public.crises c ON (
    c.titulo = COALESCE(ca.motivo, 'Crise migrada de sistema antigo')
    AND c.created_at::date = ca.criada_em::date
  )
)
INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
SELECT 
  mc.crise_id,
  mc.ticket_id,
  mc.criada_por
FROM migrated_crises mc
WHERE NOT EXISTS (
  SELECT 1 FROM public.crise_ticket_links ctl 
  WHERE ctl.crise_id = mc.crise_id AND ctl.ticket_id = mc.ticket_id
);

-- 3. Buscar tickets com prioridade crise que não estão vinculados e criar/vincular crises
WITH crisis_tickets AS (
  SELECT 
    t.id,
    t.descricao_problema,
    t.data_abertura,
    t.criado_por,
    t.unidade_id
  FROM public.tickets t
  LEFT JOIN public.crise_ticket_links ctl ON t.id = ctl.ticket_id
  WHERE t.prioridade = 'crise'
    AND ctl.ticket_id IS NULL
    AND t.data_abertura >= NOW() - INTERVAL '24 hours'
),
grouped_tickets AS (
  SELECT 
    STRING_AGG(DISTINCT SUBSTRING(descricao_problema, 1, 50), ' | ') as titulo_base,
    MIN(data_abertura) as primeira_ocorrencia,
    criado_por,
    ARRAY_AGG(id) as ticket_ids,
    COUNT(*) as ticket_count
  FROM crisis_tickets
  GROUP BY 
    LOWER(SPLIT_PART(descricao_problema, ' ', 1)),
    criado_por
  HAVING COUNT(*) >= 1
),
new_crises AS (
  INSERT INTO public.crises (titulo, descricao, status, created_at, updated_at, abriu_por)
  SELECT 
    'Crise detectada: ' || titulo_base as titulo,
    'Crise automática detectada com ' || ticket_count || ' tickets relacionados' as descricao,
    'aberto'::public.crise_status as status,
    primeira_ocorrencia as created_at,
    primeira_ocorrencia as updated_at,
    criado_por as abriu_por
  FROM grouped_tickets
  RETURNING id, titulo, abriu_por
)
INSERT INTO public.crise_ticket_links (crise_id, ticket_id, linked_by)
SELECT 
  nc.id as crise_id,
  UNNEST(gt.ticket_ids) as ticket_id,
  nc.abriu_por as linked_by
FROM new_crises nc
JOIN grouped_tickets gt ON gt.criado_por = nc.abriu_por;