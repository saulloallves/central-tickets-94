-- Executar agrupamento manual dos tickets de crise não vinculados
-- Vou vincular todos os tickets com "girabot" à crise existente

INSERT INTO crise_ticket_links (crise_id, ticket_id, linked_by)
SELECT 
  'ab1b3a79-ecad-4477-98ed-a5ea3dd2f421'::uuid,
  t.id,
  t.criado_por
FROM tickets t
LEFT JOIN crise_ticket_links ctl ON t.id = ctl.ticket_id
WHERE t.prioridade = 'crise'
AND t.status IN ('escalonado', 'em_atendimento', 'concluido') 
AND t.data_abertura >= NOW() - INTERVAL '4 hours'
AND t.descricao_problema ILIKE '%girabot%'
AND ctl.ticket_id IS NULL
AND t.id != '831f109b-970f-47a9-b03f-b1bd9ea69a5c'  -- Excluir o que já está vinculado
ON CONFLICT (crise_id, ticket_id) DO NOTHING;

-- Atualizar contagem na descrição da crise
UPDATE crises 
SET descricao = 'Crise automática com ' || (
  SELECT COUNT(*) 
  FROM crise_ticket_links ctl 
  WHERE ctl.crise_id = 'ab1b3a79-ecad-4477-98ed-a5ea3dd2f421'
) || ' tickets sobre: girabot',
updated_at = NOW()
WHERE id = 'ab1b3a79-ecad-4477-98ed-a5ea3dd2f421';

-- Adicionar update de log
INSERT INTO crise_updates (
  crise_id,
  tipo,
  mensagem,
  created_by
) VALUES (
  'ab1b3a79-ecad-4477-98ed-a5ea3dd2f421',
  'ticket_added',
  'Agrupamento manual: vinculados ' || (
    SELECT COUNT(*) 
    FROM crise_ticket_links ctl 
    WHERE ctl.crise_id = 'ab1b3a79-ecad-4477-98ed-a5ea3dd2f421'
  ) || ' tickets similares sobre girabot',
  (SELECT auth.uid())
);