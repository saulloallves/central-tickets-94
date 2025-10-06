-- Limpar todos os dados de tickets e chamados
-- ATENÇÃO: Esta operação é IRREVERSÍVEL e apaga TODOS os dados

-- Desabilitar triggers temporariamente para evitar conflitos
SET session_replication_role = replica;

-- Limpar tabelas relacionadas a tickets (ordem de dependências)
DELETE FROM public.ticket_mensagens;
DELETE FROM public.tickets_audit;
DELETE FROM public.crise_ticket_links;
DELETE FROM public.ticket_ai_interactions;
DELETE FROM public.escalation_logs;
DELETE FROM public.ai_feedback;
DELETE FROM public.knowledge_suggestions;
DELETE FROM public.knowledge_auto_approvals;
DELETE FROM public.faq_logs;

-- Limpar tickets
DELETE FROM public.tickets;

-- Limpar chamados e relacionados
DELETE FROM public.avaliacoes_atendimento;
DELETE FROM public.chamados;

-- Limpar crises
DELETE FROM public.crise_updates;
DELETE FROM public.crise_mensagens;
DELETE FROM public.crises_ativas;
DELETE FROM public.crises;

-- Limpar notificações
DELETE FROM public.notifications_queue;
DELETE FROM public.internal_notification_recipients;

-- Limpar sequências de tickets
DELETE FROM public.ticket_sequences;

-- Reabilitar triggers
SET session_replication_role = DEFAULT;

-- Log da ação
SELECT public.log_system_action(
  'sistema'::public.log_tipo,
  'database',
  'cleanup',
  'Limpeza completa: todos os tickets, chamados e dados relacionados foram removidos',
  auth.uid(),
  NULL, NULL, NULL, NULL,
  jsonb_build_object('tables_cleaned', ARRAY['tickets', 'chamados', 'ticket_mensagens', 'crises', 'notifications_queue']),
  'web'::public.log_canal
);