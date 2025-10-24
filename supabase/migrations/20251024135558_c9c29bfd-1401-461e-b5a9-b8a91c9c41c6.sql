-- ==========================================
-- FIX: Update grupo 1461 with correct id_grupo_branco
-- ==========================================

UPDATE atendente_unidades
SET 
  id_grupo_branco = '120363163110018264-group',
  updated_at = NOW()
WHERE codigo_grupo = '1461';

-- ==========================================
-- CREATE: notifications_queue table for alerts
-- ==========================================

CREATE TABLE IF NOT EXISTS notifications_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  unidade_id UUID REFERENCES atendente_unidades(id),
  ticket_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE notifications_queue ENABLE ROW LEVEL SECURITY;

-- Admins can manage all notifications
CREATE POLICY "Admins manage notifications_queue"
ON notifications_queue
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));