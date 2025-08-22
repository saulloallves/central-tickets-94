-- Create table for system settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Everyone can view system settings" 
ON public.system_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can manage system settings" 
ON public.system_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default logo setting (empty initially)
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES ('system_logo_url', '', 'URL do logo do sistema exibido na sidebar')
ON CONFLICT (setting_key) DO NOTHING;