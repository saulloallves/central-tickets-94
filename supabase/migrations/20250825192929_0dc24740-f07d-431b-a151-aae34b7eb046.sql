-- Fix infinite recursion in RLS policies comprehensively
-- Drop all problematic policies and recreate with simple, non-recursive rules

-- Disable RLS temporarily for both tables
ALTER TABLE public.unidades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on unidades
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'unidades' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.unidades';
    END LOOP;
END $$;

-- Drop ALL existing policies on tickets  
DO $$ 
DECLARE 
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'tickets' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.tickets';
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies for unidades
CREATE POLICY "unidades_select_authenticated" ON public.unidades
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "unidades_admin_manage" ON public.unidades
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create simple, non-recursive policies for tickets
CREATE POLICY "tickets_select_authenticated" ON public.tickets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tickets_insert_authenticated" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tickets_admin_manage" ON public.tickets
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));