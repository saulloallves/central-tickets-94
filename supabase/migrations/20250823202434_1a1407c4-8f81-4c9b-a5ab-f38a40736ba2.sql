-- Disable RLS on all tables

-- Core tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions DISABLE ROW LEVEL SECURITY;

-- Business tables
ALTER TABLE public.unidades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.franqueados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_members DISABLE ROW LEVEL SECURITY;

-- Ticket system
ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_mensagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sequences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_ai_interactions DISABLE ROW LEVEL SECURITY;

-- Crisis management
ALTER TABLE public.crises DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crise_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crise_ticket_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.crises_ativas DISABLE ROW LEVEL SECURITY;

-- Knowledge base
ALTER TABLE public.knowledge_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_suggestions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_article_usage DISABLE ROW LEVEL SECURITY;

-- FAQ and AI
ALTER TABLE public.faq_ai_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback DISABLE ROW LEVEL SECURITY;

-- Notifications
ALTER TABLE public.notifications_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_routes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_source_config DISABLE ROW LEVEL SECURITY;

-- System and logs
ALTER TABLE public.system_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_de_sistema DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_access_log DISABLE ROW LEVEL SECURITY;

-- Escalation
ALTER TABLE public.escalation_levels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_logs DISABLE ROW LEVEL SECURITY;

-- Messaging
ALTER TABLE public.messaging_providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates DISABLE ROW LEVEL SECURITY;

-- Access requests
ALTER TABLE public.internal_access_requests DISABLE ROW LEVEL SECURITY;

-- RAG documents
ALTER TABLE public."RAG DOCUMENTOS" DISABLE ROW LEVEL SECURITY;