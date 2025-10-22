
-- ============================================================================
-- CORREÇÃO COMPLETA DO SISTEMA DE ESCALONAMENTO SLA (SIMPLIFICADA)
-- ============================================================================

-- 1. CORREÇÃO IMEDIATA: Atualizar ticket 1761-0003 manualmente
UPDATE tickets
SET 
  sla_minutos_restantes = -11,
  status_sla = 'vencido'::ticket_sla_status,
  sla_vencido_em = '2025-10-22 11:33:02.045006-03'::timestamptz,
  sla_ultima_atualizacao = NOW()
WHERE codigo_ticket = '1761-0003';

-- 2. CRIAR CONFIGURAÇÃO DE ESCALONAMENTO PARA JARDIM MESSINA
INSERT INTO escalation_levels (
  unidade_id,
  ordem,
  role,
  destino_user_id,
  destino_whatsapp,
  ativo,
  created_at,
  updated_at
) VALUES (
  '432b894c-86b4-4374-b2f1-84246096b7ea',
  1,
  'diretoria'::app_role,
  NULL,
  NULL,
  true,
  NOW(),
  NOW()
),
(
  '432b894c-86b4-4374-b2f1-84246096b7ea',
  2,
  'admin'::app_role,
  NULL,
  NULL,
  true,
  NOW(),
  NOW()
);

-- 3. FORÇAR PROCESSAMENTO DO TICKET VENCIDO
INSERT INTO notifications_queue (
  type,
  ticket_id,
  status,
  payload,
  created_at
)
SELECT 
  'sla_breach',
  t.id,
  'pending',
  jsonb_build_object(
    'codigo_ticket', t.codigo_ticket,
    'unidade', u.grupo,
    'sla_minutos', t.sla_minutos_restantes,
    'prioridade', t.prioridade,
    'descricao_problema', LEFT(t.descricao_problema, 100),
    'vencido_ha_minutos', 11,
    'forced', true
  ),
  NOW()
FROM tickets t
LEFT JOIN unidades u ON t.unidade_id = u.id
WHERE t.codigo_ticket = '1761-0003'
ON CONFLICT (ticket_id, type) 
WHERE status IN ('pending', 'processing')
DO UPDATE SET
  status = 'pending',
  payload = EXCLUDED.payload,
  attempts = 0;
