-- Add missing columns to notifications_queue for group diagnostics
ALTER TABLE notifications_queue
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS message TEXT,
ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES atendente_unidades(id),
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;