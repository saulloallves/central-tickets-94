-- Atualizar políticas RLS para dar aos diretores as mesmas permissões dos admins

-- Tabela ai_feedback - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage ai_feedback" ON public.ai_feedback;
CREATE POLICY "Admins and diretoria manage ai_feedback" 
ON public.ai_feedback 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela audit_log - diretores já têm acesso, manter

-- Tabela colaboradores - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage all colaboradores" ON public.colaboradores;
CREATE POLICY "Admins and diretoria can manage all colaboradores" 
ON public.colaboradores 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela crise_ticket_links - diretores já têm acesso, expandir para full
DROP POLICY IF EXISTS "crise_ticket_links_admin_manage" ON public.crise_ticket_links;
CREATE POLICY "crise_ticket_links_admin_diretoria_manage" 
ON public.crise_ticket_links 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela crise_updates - diretores já têm acesso, expandir para full
DROP POLICY IF EXISTS "crise_updates_admin_manage" ON public.crise_updates;
CREATE POLICY "crise_updates_admin_diretoria_manage" 
ON public.crise_updates 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela crises - diretores já têm acesso, expandir para full
DROP POLICY IF EXISTS "crises_admin_manage" ON public.crises;
CREATE POLICY "crises_admin_diretoria_manage" 
ON public.crises 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela crises_ativas - diretores já têm acesso, expandir para full
DROP POLICY IF EXISTS "Admins manage crises_ativas" ON public.crises_ativas;
CREATE POLICY "Admins and diretoria manage crises_ativas" 
ON public.crises_ativas 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela equipe_members - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage all equipe_members" ON public.equipe_members;
CREATE POLICY "Admins and diretoria can manage all equipe_members" 
ON public.equipe_members 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela equipes - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage all equipes" ON public.equipes;
CREATE POLICY "Admins and diretoria can manage all equipes" 
ON public.equipes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela escalation_levels - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage escalation_levels" ON public.escalation_levels;
CREATE POLICY "Admins and diretoria manage escalation_levels" 
ON public.escalation_levels 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela escalation_logs - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage escalation_logs" ON public.escalation_logs;
CREATE POLICY "Admins and diretoria manage escalation_logs" 
ON public.escalation_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela faq_ai_settings - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage all faq_ai_settings" ON public.faq_ai_settings;
CREATE POLICY "Admins and diretoria can manage all faq_ai_settings" 
ON public.faq_ai_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela faq_logs - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage all faq_logs" ON public.faq_logs;
CREATE POLICY "Admins and diretoria can manage all faq_logs" 
ON public.faq_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela franqueados - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage all franqueados" ON public.franqueados;
CREATE POLICY "Admins and diretoria can manage all franqueados" 
ON public.franqueados 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela internal_access_requests - dar aos diretores acesso total
DROP POLICY IF EXISTS "IAR: admins manage all" ON public.internal_access_requests;
CREATE POLICY "IAR: admins and diretoria manage all" 
ON public.internal_access_requests 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela knowledge_article_usage - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins view knowledge_article_usage" ON public.knowledge_article_usage;
CREATE POLICY "Admins and diretoria view knowledge_article_usage" 
ON public.knowledge_article_usage 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela knowledge_articles - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage all knowledge_articles" ON public.knowledge_articles;
CREATE POLICY "Admins and diretoria can manage all knowledge_articles" 
ON public.knowledge_articles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela knowledge_suggestions - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage knowledge_suggestions" ON public.knowledge_suggestions;
CREATE POLICY "Admins and diretoria manage knowledge_suggestions" 
ON public.knowledge_suggestions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela message_templates - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage message_templates" ON public.message_templates;
CREATE POLICY "Admins and diretoria manage message_templates" 
ON public.message_templates 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela messaging_providers - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage messaging_providers" ON public.messaging_providers;
CREATE POLICY "Admins and diretoria manage messaging_providers" 
ON public.messaging_providers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela notification_routes - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage notification_routes" ON public.notification_routes;
CREATE POLICY "Admins and diretoria manage notification_routes" 
ON public.notification_routes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela notification_settings - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage notification_settings" ON public.notification_settings;
CREATE POLICY "Admins and diretoria manage notification_settings" 
ON public.notification_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela notification_source_config - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage notification_source_config" ON public.notification_source_config;
CREATE POLICY "Admins and diretoria manage notification_source_config" 
ON public.notification_source_config 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela notifications_queue - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins manage notifications_queue" ON public.notifications_queue;
CREATE POLICY "Admins and diretoria manage notifications_queue" 
ON public.notifications_queue 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela profiles - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins and diretoria can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "Admins and diretoria can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela role_permissions - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Admins and diretoria can manage role permissions" 
ON public.role_permissions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela system_settings - dar aos diretores acesso total
DROP POLICY IF EXISTS "Only admins can manage system settings" ON public.system_settings;
CREATE POLICY "Only admins and diretoria can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela ticket_ai_interactions - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage all ticket_ai_interactions" ON public.ticket_ai_interactions;
CREATE POLICY "Admins and diretoria can manage all ticket_ai_interactions" 
ON public.ticket_ai_interactions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Tabela ticket_mensagens - dar aos diretores acesso total
DROP POLICY IF EXISTS "Admins can manage all ticket messages" ON public.ticket_mensagens;
CREATE POLICY "Admins and diretoria can manage all ticket messages" 
ON public.ticket_mensagens 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

-- Comentário de finalização
COMMENT ON SCHEMA public IS 'Políticas RLS atualizadas para dar aos diretores as mesmas permissões dos admins';