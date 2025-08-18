-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.hash_password()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.senha_sistema IS NOT NULL AND NEW.senha_sistema != OLD.senha_sistema THEN
    NEW.senha_sistema = crypt(NEW.senha_sistema, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_values, user_id)
    VALUES (TG_TABLE_NAME, OLD.id::TEXT, TG_OP, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, old_values, new_values, user_id)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, new_values, user_id)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, TG_OP, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable RLS on user_flows table which was missing
ALTER TABLE public.user_flows ENABLE ROW LEVEL SECURITY;

-- Create missing RLS policies for user_flows
CREATE POLICY "Admins can manage all user_flows" ON public.user_flows
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own user_flows" ON public.user_flows
  FOR SELECT USING (auth.uid()::TEXT = user_id);