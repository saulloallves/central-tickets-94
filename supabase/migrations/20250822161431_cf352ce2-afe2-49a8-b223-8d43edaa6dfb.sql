-- Desabilitar trigger antigo que está causando duplicação de crises
-- O trigger check_and_activate_crisis da tabela crises_ativas está conflitando
-- com o novo sistema detect_and_group_crise da tabela crises

-- Remover trigger que cria crises na tabela crises_ativas
DROP TRIGGER IF EXISTS trigger_check_and_activate_crisis ON tickets;

-- Mover crises_ativas restantes para a tabela crises principal
INSERT INTO crises (id, titulo, descricao, status, created_at, abriu_por)
SELECT 
  ca.id,
  COALESCE(ca.motivo, 'Crise Ativa Migrada'),
  'Crise migrada automaticamente do sistema antigo em ' || ca.criada_em::text,
  'aberto'::crise_status,
  ca.criada_em,
  ca.criada_por
FROM crises_ativas ca
WHERE ca.resolvida_em IS NULL
AND NOT EXISTS (
  SELECT 1 FROM crises c WHERE c.id = ca.id
);

-- Vincular tickets das crises_ativas migradas
INSERT INTO crise_ticket_links (crise_id, ticket_id, linked_by)
SELECT 
  ca.id,
  ca.ticket_id,
  ca.criada_por
FROM crises_ativas ca
WHERE ca.resolvida_em IS NULL
AND NOT EXISTS (
  SELECT 1 FROM crise_ticket_links ctl 
  WHERE ctl.crise_id = ca.id AND ctl.ticket_id = ca.ticket_id
);

-- Marcar todas as crises_ativas como resolvidas para evitar conflitos futuros
UPDATE crises_ativas 
SET resolvida_em = now(), 
    resolvida_por = (SELECT auth.uid())
WHERE resolvida_em IS NULL;