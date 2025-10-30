-- Adicionar coluna destination na tabela notifications_queue
ALTER TABLE notifications_queue 
ADD COLUMN IF NOT EXISTS destination TEXT;

-- Índice para performance (buscar por destino)
CREATE INDEX IF NOT EXISTS idx_notifications_queue_destination 
ON notifications_queue(destination);

-- Comentário explicativo
COMMENT ON COLUMN notifications_queue.destination IS 
  'Número WhatsApp de destino para notificações (formato: 5511999999999)';