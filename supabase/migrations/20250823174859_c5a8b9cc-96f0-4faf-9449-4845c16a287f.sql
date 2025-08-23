-- Enable RLS on tables that have policies but RLS is disabled
ALTER TABLE public."RAG DOCUMENTOS" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on remaining public tables
ALTER TABLE public.tickets_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.view_access_log ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for unidades table
CREATE POLICY "Authenticated users can view unidades" 
ON public.unidades 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage unidades" 
ON public.unidades 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add basic RLS policies for user_roles table
CREATE POLICY "Admins can manage user_roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add basic RLS policies for user_permissions table
CREATE POLICY "Admins can manage user_permissions" 
ON public.user_permissions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own permissions" 
ON public.user_permissions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add basic RLS policies for view_access_log table
CREATE POLICY "Admins can view access logs" 
ON public.view_access_log 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add basic RLS policies for tickets_audit table
CREATE POLICY "Admins can view ticket audit" 
ON public.tickets_audit 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));