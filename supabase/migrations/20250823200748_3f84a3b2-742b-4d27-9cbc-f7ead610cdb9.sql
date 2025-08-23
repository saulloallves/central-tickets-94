-- Fix critical security issues - Enable RLS on missing tables

-- Enable RLS on unidades table
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

-- Enable RLS on tickets table  
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;