-- Step 1: Activate full replica identity for better realtime updates
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Step 5: Create critical indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_status_updated_at 
ON public.tickets (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_unidade_status 
ON public.tickets (unidade_id, status);

CREATE INDEX IF NOT EXISTS idx_tickets_equipe_status 
ON public.tickets (equipe_responsavel_id, status) 
WHERE equipe_responsavel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_sla_status 
ON public.tickets (status_sla, data_limite_sla);

-- Add tickets to realtime publication for real-time updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;