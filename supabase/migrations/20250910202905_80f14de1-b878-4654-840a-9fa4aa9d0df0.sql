-- ===== COMPREHENSIVE SYSTEM IMPROVEMENTS - PART 2 =====
-- Continue with performance indices and realtime publication

-- 1. ADD TABLES TO REALTIME PUBLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crise_ticket_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_notification_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crises;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_mensagens;

-- 2. PERFORMANCE INDICES
-- Critical indices for ticket filtering and sorting
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_prioridade ON public.tickets(prioridade);
CREATE INDEX IF NOT EXISTS idx_tickets_status_sla ON public.tickets(status_sla);
CREATE INDEX IF NOT EXISTS idx_tickets_unidade_id ON public.tickets(unidade_id);
CREATE INDEX IF NOT EXISTS idx_tickets_equipe_responsavel_id ON public.tickets(equipe_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tickets_data_abertura ON public.tickets(data_abertura);
CREATE INDEX IF NOT EXISTS idx_tickets_position ON public.tickets(position);

-- Composite indices for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_status_unidade ON public.tickets(status, unidade_id);
CREATE INDEX IF NOT EXISTS idx_tickets_prioridade_status ON public.tickets(prioridade, status);
CREATE INDEX IF NOT EXISTS idx_tickets_equipe_status ON public.tickets(equipe_responsavel_id, status);

-- Text search index for ticket content
CREATE INDEX IF NOT EXISTS idx_tickets_search ON public.tickets USING gin(
  to_tsvector('portuguese', 
    COALESCE(titulo, '') || ' ' || 
    COALESCE(descricao_problema, '') || ' ' || 
    COALESCE(codigo_ticket, '')
  )
);

-- Crisis-related indices
CREATE INDEX IF NOT EXISTS idx_crises_status ON public.crises(status);
CREATE INDEX IF NOT EXISTS idx_crises_is_active ON public.crises(is_active);
CREATE INDEX IF NOT EXISTS idx_crise_ticket_links_crise_id ON public.crise_ticket_links(crise_id);
CREATE INDEX IF NOT EXISTS idx_crise_ticket_links_ticket_id ON public.crise_ticket_links(ticket_id);

-- Notification indices
CREATE INDEX IF NOT EXISTS idx_internal_notifications_equipe ON public.internal_notifications(equipe_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON public.internal_notification_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_read ON public.internal_notification_recipients(is_read);