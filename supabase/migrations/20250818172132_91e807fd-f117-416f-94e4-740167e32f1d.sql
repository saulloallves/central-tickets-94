-- Enable RLS on all public tables that need it
ALTER TABLE public.user_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v_tickets_por_unidade_mes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v_tickets_sla_overview ENABLE ROW LEVEL SECURITY;