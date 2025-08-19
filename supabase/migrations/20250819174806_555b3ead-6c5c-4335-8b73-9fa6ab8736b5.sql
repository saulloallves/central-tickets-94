-- Fix security issues by enabling RLS on missing tables
ALTER TABLE public.franqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flows ENABLE ROW LEVEL SECURITY;

-- Add basic policies for these tables
CREATE POLICY "Authenticated users can view unidades" ON public.unidades
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own user_flows" ON public.user_flows
FOR SELECT USING ((auth.uid())::text = user_id);