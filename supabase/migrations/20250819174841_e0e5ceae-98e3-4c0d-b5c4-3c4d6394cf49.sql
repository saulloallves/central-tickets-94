-- Fix security issues by enabling RLS on missing tables
ALTER TABLE public.franqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flows ENABLE ROW LEVEL SECURITY;