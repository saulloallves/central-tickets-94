-- Enhanced role system with permissions
-- Update existing app_role enum to include new roles
DROP TYPE IF EXISTS app_role CASCADE;
CREATE TYPE app_role AS ENUM (
  'admin',
  'diretoria', 
  'gestor_equipe',
  'gestor_unidade',
  'franqueado',
  'colaborador',
  'auditor_juridico'
);

-- Create permissions enum
CREATE TYPE app_permission AS ENUM (
  'view_all_tickets',
  'view_own_unit_tickets', 
  'view_team_tickets',
  'respond_tickets',
  'escalate_tickets',
  'access_dashboards',
  'manage_knowledge_base',
  'validate_ai_content',
  'configure_ai_models',
  'view_audit_logs',
  'export_reports',
  'view_all_history',
  'manage_crisis',
  'supervise_units',
  'validate_ai_responses'
);

-- Create role permissions mapping table
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  permission app_permission NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(role, permission)
);

-- Create user permissions table for custom permissions
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission app_permission NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for role_permissions
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view role permissions" ON public.role_permissions
FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS policies for user_permissions  
CREATE POLICY "Admins can manage user permissions" ON public.user_permissions
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own permissions" ON public.user_permissions
FOR SELECT USING (auth.uid() = user_id);

-- Insert default role permissions
INSERT INTO public.role_permissions (role, permission) VALUES
-- Admin - all permissions
('admin', 'view_all_tickets'),
('admin', 'view_own_unit_tickets'),
('admin', 'view_team_tickets'), 
('admin', 'respond_tickets'),
('admin', 'escalate_tickets'),
('admin', 'access_dashboards'),
('admin', 'manage_knowledge_base'),
('admin', 'validate_ai_content'),
('admin', 'configure_ai_models'),
('admin', 'view_audit_logs'),
('admin', 'export_reports'),
('admin', 'view_all_history'),
('admin', 'manage_crisis'),
('admin', 'supervise_units'),
('admin', 'validate_ai_responses'),

-- Diretoria
('diretoria', 'view_all_tickets'),
('diretoria', 'view_own_unit_tickets'),
('diretoria', 'view_team_tickets'),
('diretoria', 'respond_tickets'),
('diretoria', 'escalate_tickets'),
('diretoria', 'access_dashboards'),
('diretoria', 'manage_knowledge_base'),
('diretoria', 'validate_ai_content'),
('diretoria', 'view_audit_logs'),
('diretoria', 'export_reports'),
('diretoria', 'view_all_history'),
('diretoria', 'manage_crisis'),
('diretoria', 'supervise_units'),

-- Gestor Equipe
('gestor_equipe', 'view_team_tickets'),
('gestor_equipe', 'view_own_unit_tickets'),
('gestor_equipe', 'respond_tickets'),
('gestor_equipe', 'escalate_tickets'),
('gestor_equipe', 'access_dashboards'),
('gestor_equipe', 'manage_knowledge_base'),
('gestor_equipe', 'validate_ai_content'),
('gestor_equipe', 'export_reports'),
('gestor_equipe', 'view_all_history'),
('gestor_equipe', 'validate_ai_responses'),

-- Gestor Unidade
('gestor_unidade', 'view_own_unit_tickets'),
('gestor_unidade', 'respond_tickets'),
('gestor_unidade', 'escalate_tickets'),
('gestor_unidade', 'access_dashboards'),
('gestor_unidade', 'export_reports'),

-- Franqueado
('franqueado', 'view_own_unit_tickets'),
('franqueado', 'access_dashboards'),
('franqueado', 'export_reports'),

-- Colaborador
('colaborador', 'view_own_unit_tickets'),

-- Auditor Juridico
('auditor_juridico', 'view_all_tickets'),
('auditor_juridico', 'view_audit_logs'),
('auditor_juridico', 'export_reports'),
('auditor_juridico', 'view_all_history');

-- Create enhanced permission checking function
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission app_permission)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Check if user has permission through role
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    WHERE ur.user_id = _user_id 
    AND rp.permission = _permission
  ) OR EXISTS (
    -- Check if user has direct permission that hasn't expired
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = _user_id 
    AND up.permission = _permission
    AND (up.expires_at IS NULL OR up.expires_at > now())
  )
$$;

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(permission app_permission)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Get permissions from roles
  SELECT DISTINCT rp.permission
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role = rp.role
  WHERE ur.user_id = _user_id
  
  UNION
  
  -- Get direct permissions that haven't expired
  SELECT up.permission
  FROM public.user_permissions up
  WHERE up.user_id = _user_id 
  AND (up.expires_at IS NULL OR up.expires_at > now())
$$;

-- Update existing RLS policies to use new permission system
-- Update tickets policies
DROP POLICY IF EXISTS "Users can view tickets they have access to" ON public.tickets;
CREATE POLICY "Users can view tickets they have access to" ON public.tickets
FOR SELECT USING (
  has_permission(auth.uid(), 'view_all_tickets'::app_permission) OR
  (has_permission(auth.uid(), 'view_own_unit_tickets'::app_permission) AND can_view_ticket(unidade_id))
);

-- Update faq_ai_settings for AI configuration access
DROP POLICY IF EXISTS "Authenticated users can view active faq_ai_settings" ON public.faq_ai_settings;
CREATE POLICY "Users with permission can view faq_ai_settings" ON public.faq_ai_settings
FOR SELECT USING (
  has_permission(auth.uid(), 'configure_ai_models'::app_permission) OR
  has_permission(auth.uid(), 'validate_ai_content'::app_permission)
);

CREATE POLICY "Users with permission can manage faq_ai_settings" ON public.faq_ai_settings
FOR ALL USING (has_permission(auth.uid(), 'configure_ai_models'::app_permission))
WITH CHECK (has_permission(auth.uid(), 'configure_ai_models'::app_permission));

-- Add audit table for view access
CREATE TABLE public.view_access_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  resource_type text NOT NULL,
  resource_id text,
  accessed_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text
);

ALTER TABLE public.view_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access logs" ON public.view_access_log
FOR SELECT USING (has_permission(auth.uid(), 'view_audit_logs'::app_permission));

-- Function to log view access
CREATE OR REPLACE FUNCTION public.log_view_access(
  _resource_type text,
  _resource_id text DEFAULT NULL,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.view_access_log (user_id, resource_type, resource_id, ip_address, user_agent)
  VALUES (auth.uid(), _resource_type, _resource_id, _ip_address, _user_agent);
END;
$$;